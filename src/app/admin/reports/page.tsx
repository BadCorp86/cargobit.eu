import AdminModulePage from '@/components/admin/admin-module-page';

export default function AdminReportsPage() {
  return (
    <AdminModulePage
      title="Berichte"
      subtitle="Finanz-, Operations- und Compliance-Berichte konsolidieren"
      description="Dieses Modul bündelt künftig Umsatz, Provisionen, Wallet-Gebühren, Versicherungsprovisionen, Dispute-Kosten und operative Kennzahlen. Bestehende Export- und Reconciliation-Endpunkte werden hier zusammengeführt."
      primaryHref="/admin/payments"
      primaryLabel="Zahlungen öffnen"
      metrics={[
        { label: 'Monatsumsatz', value: '189.750 €', tone: 'green' },
        { label: 'Offene Abgleiche', value: '14', tone: 'yellow' },
        { label: 'Export-Jobs', value: '6', tone: 'cyan' },
        { label: 'Risiko-Fälle', value: '8', tone: 'red' },
      ]}
      tasks={[
        'Reconciliation-, Payment-, Insurance- und Wallet-Daten in Berichtsansichten zusammenführen.',
        'PDF/CSV-Exports für Monatsabschluss, Provisionen und Steuerübersichten bereitstellen.',
        'Filter nach Zeitraum, Rolle, Land, Status und Zahlungsanbieter ergänzen.',
        'Admin- und Finance-Rollen mit getrennten Exportrechten absichern.',
      ]}
    />
  );
}
