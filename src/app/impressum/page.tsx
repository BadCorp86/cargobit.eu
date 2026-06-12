import { LegalPage, LegalSection } from '@/components/legal/legal-page';

export default function ImpressumPage() {
  return (
    <LegalPage
      title="Impressum"
      subtitle="Anbieterkennzeichnung für die CargoBit Plattform."
    >
      <LegalSection title="Anbieter">
        <p>CargoBit</p>
        <p>Sergej W. / Betreiberangaben vor Livegang ergänzen</p>
        <p>Deutschland / Geschäftsanschrift vor Livegang ergänzen</p>
      </LegalSection>

      <LegalSection title="Kontakt">
        <p>E-Mail: support@cargobit.eu</p>
        <p>Telefon und zuständige Registerdaten werden vor dem produktiven Betrieb ergänzt.</p>
      </LegalSection>

      <LegalSection title="Verantwortlich für Inhalte">
        <p>Verantwortlich nach den geltenden medienrechtlichen Vorschriften: Betreiber der CargoBit Plattform.</p>
      </LegalSection>

      <LegalSection title="Tätigkeit der Plattform">
        <p>
          CargoBit stellt eine digitale Vermittlungsplattform für Transportanfragen, Angebote, Zahlungsschutz,
          Dokumentation und operative Kommunikation bereit. CargoBit ist nicht selbst ausführender Frachtführer,
          Spediteur, Versicherer oder Zahlungsinstitut.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
