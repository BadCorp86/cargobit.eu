import { LegalPage, LegalSection } from '@/components/legal/legal-page';

export default function ZahlungsschutzPage() {
  return (
    <LegalPage
      title="Zahlungsschutzbedingungen"
      subtitle="Regeln für Wallet, Reservierung, Freigabe und Auszahlung."
    >
      <LegalSection title="Grundprinzip">
        <p>
          Der Zahlungsschutz dient dazu, Transportzahlungen transparent zu reservieren, nachzuweisen und nach
          erfolgreicher Durchführung freizugeben. Stripe oder andere Zahlungsdienstleister wickeln Ein- und Auszahlungen ab.
        </p>
      </LegalSection>

      <LegalSection title="Reservierung">
        <p>
          Ein Auftrag kann erst veröffentlicht werden, wenn ausreichend verfügbares Guthaben für den empfohlenen
          Auftragspreis und die angezeigten Gebühren vorhanden ist. Das Guthaben wird reserviert, aber erst nach
          Annahme und Abwicklung entsprechend verrechnet.
        </p>
      </LegalSection>

      <LegalSection title="Freigabe">
        <p>
          Nach Lieferung und Abliefernachweis läuft eine 24-Werktagsstunden-Frist. Offene Disputes oder Supportfälle
          blockieren die automatische Freigabe bis zur Klärung.
        </p>
      </LegalSection>

      <LegalSection title="Auszahlung">
        <p>
          Bankauszahlungen können nur aus dem eigenen Wallet-Bereich gestartet werden, sofern Guthaben vorhanden,
          die Auszahlungsmethode verifiziert und keine Sperre aktiv ist.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
