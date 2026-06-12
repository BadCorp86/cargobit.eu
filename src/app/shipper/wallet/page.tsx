import { UserWalletPage } from '@/components/wallet/user-wallet-page';

export default async function ShipperWalletPage({
  searchParams,
}: {
  searchParams?: Promise<{ amount?: string; returnTo?: string }>;
}) {
  const params = await searchParams;

  return (
    <UserWalletPage
      title="Zahlungsschutz"
      subtitle="Auftragsbezogene Zahlungen für neue Transporte vorbereiten und reservierte Beträge nachvollziehen."
      walletPurpose="shipper"
      initialTopupAmount={params?.amount}
      returnTo={params?.returnTo}
    />
  );
}
