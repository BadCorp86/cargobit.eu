import { redirect } from 'next/navigation';

const supportRoutes: Record<string, string> = {
  tickets: '/admin/feedback',
  transports: '/admin/transports',
  users: '/admin/users',
  ai: '/dashboard?role=support',
};

export default async function SupportFallbackPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const key = slug[0] || '';
  redirect(supportRoutes[key] || '/dashboard?role=support');
}
