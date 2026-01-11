import { redirect } from 'next/navigation';

export default function DashboardPage() {
  // Redirect to leads page by default
  redirect('/leads');
}
