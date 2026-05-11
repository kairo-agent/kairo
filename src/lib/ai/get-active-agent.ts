/**
 * KAIRO - Active Agent Resolver
 *
 * Resolves the "currently active" AI agent for a given project.
 * Source of truth at runtime: `ai_agents.isActive = true` for the project.
 *
 * Why this exists:
 *   `lead.assignedAgentId` is now treated as HISTORICAL — it records which
 *   agent first attended the lead. The agent that actually responds to new
 *   messages (WhatsApp / WebChat / re-engagement) is always the project's
 *   currently active agent, regardless of `assignedAgentId`.
 *
 * Cache strategy:
 *   - Redis (Upstash) with 5min TTL as safety net.
 *   - Explicit invalidation in `toggleAgentStatus` for immediate consistency.
 *   - Falls back to direct DB query when Redis is unavailable.
 */
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';

export type ActiveAgent = {
  id: string;
  name: string;
  systemInstructions: string | null;
  promptStructure: unknown;
  formConfig: unknown;
};

const CACHE_TTL_SECONDS = 300;
const cacheKey = (projectId: string) => `active_agent:${projectId}`;

export async function getActiveAgentForProject(
  projectId: string
): Promise<ActiveAgent | null> {
  const redis = await getRedis();
  const key = cacheKey(projectId);

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        // @upstash/redis may auto-deserialize objects; handle both shapes.
        return typeof cached === 'string'
          ? (JSON.parse(cached) as ActiveAgent)
          : (cached as ActiveAgent);
      }
    } catch (err) {
      console.error('[getActiveAgentForProject] Redis read error:', err);
    }
  }

  const agent = await prisma.aIAgent.findFirst({
    where: { projectId, isActive: true },
    select: {
      id: true,
      name: true,
      systemInstructions: true,
      promptStructure: true,
      formConfig: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!agent) return null;

  const serializable: ActiveAgent = {
    id: agent.id,
    name: agent.name,
    systemInstructions: agent.systemInstructions,
    promptStructure: agent.promptStructure,
    formConfig: agent.formConfig,
  };

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(serializable), { ex: CACHE_TTL_SECONDS });
    } catch (err) {
      console.error('[getActiveAgentForProject] Redis write error:', err);
    }
  }

  return serializable;
}

export async function invalidateActiveAgentCache(projectId: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.del(cacheKey(projectId));
  } catch (err) {
    console.error('[invalidateActiveAgentCache] Redis del error:', err);
  }
}
