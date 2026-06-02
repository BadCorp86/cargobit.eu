import AdminModulePage from '@/components/admin/admin-module-page';

export default function AdminVehiclesPage() {
  return (
    <AdminModulePage
      title="Fahrzeuge"
      subtitle="Flotte, Kapazitäten und Fahrzeugnachweise prüfen"
      description="Dieses Modul wird Fahrzeuge, Kapazitäten, Sonderausstattung, Versicherungsnachweise und Zuordnung zu Fahrern oder Speditionen abbilden. Damit kann CargoBit später Matching und Compliance genauer steuern."
      primaryHref="/admin/verifications"
      primaryLabel="Verifizierungen öffnen"
      metrics={[
        { label: 'Registrierte Fahrzeuge', value: '1.094', tone: 'blue' },
        { label: 'Nachweise offen', value: '28', tone: 'yellow' },
        { label: 'Sonderfahrzeuge', value: '146', tone: 'cyan' },
        { label: 'Nicht freigegeben', value: '19', tone: 'red' },
      ]}
      tasks={[
        'Fahrzeugdatenmodell mit Kapazität, Ladefläche, Kühlung, Gefahrgut und Tieflader-Fähigkeit verbinden.',
        'Dokumentenprüfung für Versicherung, Zulassung und Sonderzertifikate an Verifizierungen anbinden.',
        'Fahrzeugverfügbarkeit für Matching und KI-Preislogik berücksichtigen.',
        'Admin-Freigabe mit Audit-Trail und Sperrgrund ergänzen.',
      ]}
    />
  );
}
