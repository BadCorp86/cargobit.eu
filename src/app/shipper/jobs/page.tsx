import { ShipperJobsPage } from '@/components/pages/shipper-jobs-page';

type ShipperJobsView = 'active' | 'offers' | 'drafts' | 'completed' | 'all';

function normalizeView(value?: string | string[]): ShipperJobsView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === 'offers' || candidate === 'drafts' || candidate === 'completed' || candidate === 'all'
    ? candidate
    : 'active';
}

export default async function ShipperJobsRoute({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <ShipperJobsPage initialView={normalizeView(params?.view)} />;
}
