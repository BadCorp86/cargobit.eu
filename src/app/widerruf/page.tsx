import { LegalPage, LegalSection } from '@/components/legal/legal-page';

export default function WiderrufPage() {
  return (
    <LegalPage
      title="Widerruf und Verbraucherhinweise"
      subtitle="Informationen für Verbraucher und private Auftraggeber."
    >
      <LegalSection title="Verbraucherstatus">
        <p>
          Private Nutzer können Verbraucherrechte haben. Ob ein Widerrufsrecht besteht, hängt von der konkreten
          Leistung, dem Vertragspartner, dem Zeitpunkt der Ausführung und gesetzlichen Ausnahmen ab.
        </p>
      </LegalSection>

      <LegalSection title="Digitale Plattformleistungen">
        <p>
          Bei sofortiger Ausführung digitaler Plattformleistungen kann ein Widerrufsrecht unter gesetzlichen
          Voraussetzungen eingeschränkt sein oder erlöschen, wenn der Nutzer ausdrücklich zustimmt.
        </p>
      </LegalSection>

      <LegalSection title="Transportleistungen">
        <p>
          Für bestimmte Transport-, Termin- oder Beförderungsleistungen können besondere gesetzliche Regeln gelten.
          Die konkreten Hinweise werden im Auftragsprozess angezeigt.
        </p>
      </LegalSection>

      <LegalSection title="Kontakt">
        <p>Widerrufs- oder Verbraucherfragen können an support@cargobit.eu gerichtet werden.</p>
      </LegalSection>
    </LegalPage>
  );
}
