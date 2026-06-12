import { LegalPage, LegalSection } from '@/components/legal/legal-page';

export default function VermittlungHaftungPage() {
  return (
    <LegalPage
      title="Vermittlung und Haftung"
      subtitle="Hinweise zur Rolle von CargoBit im Transportprozess."
    >
      <LegalSection title="Keine eigene Transportdurchführung">
        <p>
          CargoBit führt Transporte nicht selbst aus. Die Verantwortung für tatsächliche Abholung, Ladungssicherung,
          Transport, Lieferung, Genehmigungen und gesetzliche Pflichten liegt bei den beteiligten Vertragsparteien.
        </p>
      </LegalSection>

      <LegalSection title="Prüfung und Verifizierung">
        <p>
          CargoBit kann Dokumente, Profile und Risikosignale prüfen. Eine Prüfung ersetzt keine eigene rechtliche,
          steuerliche, technische oder versicherungsbezogene Prüfung durch die Nutzer.
        </p>
      </LegalSection>

      <LegalSection title="Haftung">
        <p>
          CargoBit haftet nach den gesetzlichen Vorschriften für eigene Pflichtverletzungen. Für Leistungen Dritter,
          Transportausführung, Schäden an Fracht oder Versicherungsentscheidungen haftet CargoBit nur, soweit gesetzlich
          zwingend vorgeschrieben.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
