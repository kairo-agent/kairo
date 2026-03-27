// ============================================
// KAIRO - Dashboard Page (Server Component)
// Fetches initial stats via SSR for instant load
// ============================================

import { verifyAuth } from '@/lib/actions/auth';
import { getDashboardStatsSSR } from '@/lib/actions/dashboard';
import DashboardClient from './DashboardClient';

export default async function DashboardOverviewPage() {
  const user = await verifyAuth();

  if (!user) {
    // Layout should have already redirected, but guard defensively
    return (
      <DashboardClient
        initialStats={{
          totalLeads: 0,
          leadsWon: 0,
          leadsInHumanMode: 0,
          activeAgents: 0,
          archivedLeads: 0,
        }}
      />
    );
  }

  const authContext = { id: user.id, systemRole: user.systemRole };
  const stats = await getDashboardStatsSSR(authContext, undefined, undefined, 'last30days');

  return <DashboardClient initialStats={stats} />;
}
