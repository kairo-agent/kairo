import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

export default async function DashboardPage() {
  const locale = await getLocale();
  // Redirect to leads page with locale prefix (e.g., /es/leads)
  redirect(`/${locale}/leads`);
}
