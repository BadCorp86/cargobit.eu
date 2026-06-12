import { redirect } from 'next/navigation';

const marketerRoutes: Record<string, string> = {
  campaigns: '/dashboard?role=marketer',
  partners: '/dashboard?role=marketer',
  analytics: '/dashboard?role=marketer',
  reports: '/admin/reports',
};

export default async function MarketerFallbackPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const key = slug[0] || '';
  redirect(marketerRoutes[key] || '/dashboard?role=marketer');
}
