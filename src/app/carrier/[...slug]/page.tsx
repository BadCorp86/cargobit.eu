import { redirect } from 'next/navigation';

function carrierTarget(slug: string[]) {
  const [first, second] = slug;

  if (first === 'loads') return '/marketplace';
  if (first === 'dispatch' || second === 'suggestions' || second === 'tours') return '/dashboard?role=dispatcher';
  if (first === 'fleet' || first === 'drivers') return '/dashboard?role=carrier';
  if (first === 'support') return '/dashboard?role=support';

  return '/dashboard?role=carrier';
}

export default async function CarrierFallbackPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  redirect(carrierTarget(slug));
}
