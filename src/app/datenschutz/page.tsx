import { LegalPage, LegalSection } from '@/components/legal/legal-page';

export default function DatenschutzPage() {
  return (
    <LegalPage
      title="Datenschutzerklärung"
      subtitle="Informationen zur Verarbeitung personenbezogener Daten bei Nutzung von CargoBit."
    >
      <LegalSection title="Verantwortlicher">
        <p>Verantwortlicher ist der Betreiber der CargoBit Plattform. Vollständige Kontaktdaten werden im Impressum geführt.</p>
      </LegalSection>

      <LegalSection title="Verarbeitete Daten">
        <p>
          Wir verarbeiten Konto-, Kontakt-, Rollen-, Unternehmens-, Verifizierungs-, Auftrags-, Angebots-, Wallet-,
          Zahlungs-, Tracking-, Support- und technische Logdaten, soweit sie für Betrieb, Sicherheit und Abwicklung
          der Plattform erforderlich sind.
        </p>
      </LegalSection>

      <LegalSection title="Zwecke">
        <p>
          Die Daten werden zur Registrierung, Verifizierung, Auftragserstellung, Angebotserstellung, Kommunikation,
          Zahlungsschutz, Rechnungsstellung, Missbrauchsprävention, Support und Verbesserung der Plattform verarbeitet.
        </p>
      </LegalSection>

      <LegalSection title="Empfänger und Dienstleister">
        <p>
          Je nach Nutzung können Daten an Zahlungsdienstleister, E-Mail-Dienstleister, Karten-/Routinganbieter,
          Verifizierungsdienstleister, Hostinganbieter, Versicherungs- oder Maklerpartner sowie an beteiligte
          Transportparteien übermittelt werden.
        </p>
      </LegalSection>

      <LegalSection title="Trackingdaten">
        <p>
          Standortdaten werden nur im Zusammenhang mit aktiven Transporten genutzt. Sichtbar sind sie nur für
          berechtigte Beteiligte, Admin/Support und nur soweit für Durchführung, Nachweis oder Sicherheit erforderlich.
        </p>
      </LegalSection>

      <LegalSection title="Rechte betroffener Personen">
        <p>
          Betroffene Personen haben nach Maßgabe der DSGVO Rechte auf Auskunft, Berichtigung, Löschung,
          Einschränkung, Datenübertragbarkeit, Widerspruch und Beschwerde bei einer Aufsichtsbehörde.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
