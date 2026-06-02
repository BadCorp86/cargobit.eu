import AdminModulePage from '@/components/admin/admin-module-page';

export default function AdminDriversPage() {
  return (
    <AdminModulePage
      title="Fahrer"
      subtitle="Fahrer, Solo-Transporteure und mobile Arbeitsabläufe verwalten"
      description="Dieses Modul soll Fahrerprofile, Dokumente, Verfügbarkeit, mobile Touren, POD-Qualität und Trust-Signale zusammenführen. Die operative Verwaltung bleibt bis zur Datenanbindung im Benutzer- und Verifizierungsbereich."
      primaryHref="/admin/users"
      primaryLabel="Benutzer öffnen"
      metrics={[
        { label: 'Aktive Fahrer', value: '2.318', tone: 'green' },
        { label: 'Verifizierung offen', value: '31', tone: 'yellow' },
        { label: 'Mobile Touren', value: '612', tone: 'cyan' },
        { label: 'Gesperrt', value: '12', tone: 'red' },
      ]}
      tasks={[
        'Fahrerprofile aus User-, Verification- und Execution-Daten aggregieren.',
        'Dokumentenstatus für Führerschein, Versicherung, Gewerbe und Zertifikate anzeigen.',
        'Mobile Fahreraktionen wie Abholung, Unterwegs, Lieferung und POD in einer Timeline darstellen.',
        'Trust Score, Stornoquote und Schadenmeldungen für Admin/Support sichtbar machen.',
      ]}
    />
  );
}
