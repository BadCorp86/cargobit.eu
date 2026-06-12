import { redirect } from 'next/navigation';

const shipperRoutes: Record<string, string> = {
  new: '/#auftrag',
  transports: '/shipper/jobs?view=active',
  offers: '/shipper/jobs?view=offers',
  documents: '/dashboard?role=shipper',
  support: '/dashboard?role=support',
};

export default async function ShipperFallbackPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const key = slug[0] || '';
  redirect(shipperRoutes[key] || '/dashboard?role=shipper');
}
