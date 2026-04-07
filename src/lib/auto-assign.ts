// ============================================
// KAIRO - Lead Auto-Assignment Logic
// Assigns new leads to team members based on
// configured percentage distribution.
// ============================================

import { prisma } from '@/lib/prisma';

interface AutoAssignmentMember {
  userId: string;
  percentage: number;
}

interface AutoAssignmentConfig {
  enabled: boolean;
  members: AutoAssignmentMember[];
}

/**
 * Determine which user should be assigned a new lead based on
 * the project's auto-assignment configuration.
 *
 * Algorithm: Weighted distribution based on configured percentages.
 * Counts today's leads per member and assigns to whoever is furthest
 * below their target percentage.
 *
 * Returns userId or null if auto-assignment is disabled/not configured.
 */
export async function getAutoAssignUserId(projectId: string): Promise<string | null> {
  try {
    // Fetch project auto-assignment config
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { leadAutoAssignment: true },
    });

    const config = project?.leadAutoAssignment as AutoAssignmentConfig | null;
    if (!config?.enabled || !config.members?.length) return null;

    // Only members with percentage > 0
    const activeMembers = config.members.filter(m => m.percentage > 0);
    if (activeMembers.length === 0) return null;

    // If only 1 member, always assign to them
    if (activeMembers.length === 1) return activeMembers[0].userId;

    // Count today's leads assigned to each member in this project
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayCounts = await prisma.lead.groupBy({
      by: ['assignedUserId'],
      where: {
        projectId,
        assignedUserId: { in: activeMembers.map(m => m.userId) },
        createdAt: { gte: startOfDay },
      },
      _count: true,
    });

    const countMap = new Map<string, number>();
    for (const row of todayCounts) {
      if (row.assignedUserId) {
        countMap.set(row.assignedUserId, row._count);
      }
    }

    const totalToday = Array.from(countMap.values()).reduce((sum, c) => sum + c, 0);

    // Find the member whose actual % is furthest below their target %
    // This naturally balances the distribution over time
    let bestUserId = activeMembers[0].userId;
    let maxDeficit = -Infinity;

    for (const member of activeMembers) {
      const actual = countMap.get(member.userId) || 0;
      const actualPct = totalToday > 0 ? (actual / totalToday) * 100 : 0;
      const deficit = member.percentage - actualPct;

      if (deficit > maxDeficit) {
        maxDeficit = deficit;
        bestUserId = member.userId;
      }
    }

    return bestUserId;
  } catch (error) {
    console.error('[Auto-assign] Error determining user:', error);
    return null;
  }
}
