import { redirect } from 'next/navigation';

const driverRoutes: Record<string, string> = {
  job: '/orders/mission_demo_hh_muc?viewer=driver',
  navigation: '/driver/mobile',
  documents: '/driver/mobile',
  support: '/dashboard?role=support',
};

export default async function DriverFallbackPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const key = slug[0] || '';
  redirect(driverRoutes[key] || '/dashboard?role=driver');
}
