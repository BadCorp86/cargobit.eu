import { LegalPage, LegalSection } from '@/components/legal/legal-page';

export default function VersicherungPartnerPage() {
  return (
    <LegalPage
      title="Versicherung und Partner"
      subtitle="Hinweise zu externen Versicherungs- und Partnerangeboten."
    >
      <LegalSection title="Partner-Lead statt Versicherungsvertrieb">
        <p>
          CargoBit kann Nutzer auf externe Versicherer, Makler oder Partner hinweisen und eine Anfrage technisch
          weiterleiten. Abschluss, Beratung, Police, Deckung und Schadenbearbeitung erfolgen beim jeweiligen
          lizenzierten Anbieter.
        </p>
      </LegalSection>

      <LegalSection title="Provisionen">
        <p>
          CargoBit kann für vermittelte Partner-Leads oder abgeschlossene Zusatzleistungen eine Provision erhalten.
          Soweit erforderlich, wird dies im jeweiligen Angebotsprozess transparent angezeigt.
        </p>
      </LegalSection>

      <LegalSection title="Keine Deckungszusage">
        <p>
          Eine Anzeige innerhalb von CargoBit ist keine Garantie für Annahme, Deckung, Schadenregulierung oder
          konkrete Versicherungsbedingungen.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
