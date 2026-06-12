import { UserWalletPage } from '@/components/wallet/user-wallet-page';

export default function DriverEarningsPage() {
  return (
    <UserWalletPage
      title="Fahrer Auszahlungen"
      subtitle="Deine freigegebenen Tour-Zahlungen und Auszahlungen auf deine verifizierte Auszahlungsmethode."
      walletPurpose="driver"
    />
  );
}
