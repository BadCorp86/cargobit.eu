import { CarrierJobsPage } from '@/components/pages/carrier-jobs-page';

type CarrierJobsView = 'active' | 'offers' | 'completed' | 'all';

function normalizeView(value?: string | string[]): CarrierJobsView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === 'offers' || candidate === 'completed' || candidate === 'all' ? candidate : 'active';
}

export default async function CarrierJobsRoute({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <CarrierJobsPage initialView={normalizeView(params?.view)} />;
}
