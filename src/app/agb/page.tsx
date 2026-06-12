import { LegalPage, LegalSection } from '@/components/legal/legal-page';

export default function AgbPage() {
  return (
    <LegalPage
      title="Allgemeine Geschäftsbedingungen"
      subtitle="Grundregeln für die Nutzung der CargoBit Plattform."
    >
      <LegalSection title="Leistungsgegenstand">
        <p>
          CargoBit betreibt eine digitale Transportplattform. Nutzer können Transportanfragen erstellen,
          Angebote abgeben, Aufträge verwalten, Dokumente austauschen und Zahlungsschutz-Funktionen nutzen.
        </p>
      </LegalSection>

      <LegalSection title="Rolle von CargoBit">
        <p>
          CargoBit vermittelt technische und organisatorische Plattformleistungen. Der eigentliche Transportvertrag
          entsteht zwischen Auftraggeber und ausführendem Transporteur, sofern nicht ausdrücklich anders vereinbart.
        </p>
      </LegalSection>

      <LegalSection title="Nutzerpflichten">
        <p>
          Nutzer müssen wahrheitsgemäße Angaben machen, erforderliche Dokumente bereitstellen, gesetzliche Vorgaben
          einhalten und dürfen keine illegalen, gefährlichen oder falsch deklarierten Güter einstellen.
        </p>
      </LegalSection>

      <LegalSection title="Angebote und Aufträge">
        <p>
          KI-Preisempfehlungen sind Orientierungshilfen und keine verbindlichen Angebote. Verbindlich wird ein Auftrag
          erst nach Annahme eines konkreten Angebots und den jeweils geltenden Zahlungs- und Prüfregeln.
        </p>
      </LegalSection>

      <LegalSection title="Gebühren">
        <p>
          CargoBit kann Provisionen, Zahlungsschutzgebühren und Business-Gebühren erheben. Die konkret geltenden
          Gebühren werden vor Vertragsschluss oder Auftragsannahme angezeigt.
        </p>
      </LegalSection>

      <LegalSection title="Sperrung und Prüfung">
        <p>
          CargoBit kann Konten, Aufträge oder Auszahlungen bei Missbrauchsverdacht, offenen Prüfungen, falschen
          Angaben, Zahlungsproblemen oder rechtlichen Risiken vorübergehend sperren.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
