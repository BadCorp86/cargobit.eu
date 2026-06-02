import AdminModulePage from '@/components/admin/admin-module-page';

export default function AdminTransportsPage() {
  return (
    <AdminModulePage
      title="Transporte"
      subtitle="Live-Überwachung aktiver Transporte, Routen und Statusereignisse"
      description="Dieses Modul bündelt künftig laufende Transporte, Tracking-Ereignisse, POD-Status, Risiko-Hinweise und operative Eskalationen. Für die erste stabile Version führt es Admins gezielt in den vorhandenen Auftragsbereich."
      primaryHref="/admin/jobs"
      primaryLabel="Aufträge öffnen"
      metrics={[
        { label: 'Aktive Transporte', value: '1.842', tone: 'blue' },
        { label: 'POD offen', value: '47', tone: 'yellow' },
        { label: 'Risk Gate grün', value: '96%', tone: 'green' },
        { label: 'Eskalationen', value: '8', tone: 'red' },
      ]}
      tasks={[
        'Transportliste mit Live-Status aus Jobs, Executions und Tracking-Events verbinden.',
        'Filter für verspätet, POD offen, Dispute offen und Versicherung empfohlen ergänzen.',
        'Admin-Aktionen auf echte Rollenrechte begrenzen: Support sieht Fälle, Finance sieht Settlement.',
        'Detailseite mit Timeline, Fahrerstatus, Rechnung, Wallet-Reservierung und Payout-Freigabe anbinden.',
      ]}
    />
  );
}
