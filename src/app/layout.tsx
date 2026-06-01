import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  metadataBase: new URL("https://cargobit.eu"),
  title: {
    default: "CargoBit | Digitale Transportplattform mit KI-Preisrechner",
    template: "%s | CargoBit",
  },
  description:
    "CargoBit ist die digitale Transportplattform für Verlader, Transporteure, Fahrer und Speditionen. Berechnen Sie realistische Transportpreise, veröffentlichen Sie Frachtaufträge und erhalten Sie Angebote.",
  applicationName: "CargoBit",
  keywords: [
    "Transportplattform",
    "Logistikplattform",
    "Transportpreis berechnen",
    "Transportauftrag erstellen",
    "Spedition finden",
    "Fracht transportieren",
    "Transporteur finden",
    "Sondertransport",
    "digitale Logistik",
    "Frachtboerse Alternative",
    "Transport Marketplace",
  ],
  alternates: {
    canonical: "https://cargobit.eu",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: "https://cargobit.eu",
    siteName: "CargoBit",
    title: "CargoBit | Digitale Transportplattform mit KI-Preisrechner",
    description:
      "Transportpreis online berechnen, Frachtauftrag erstellen und passende Speditionen, Fahrer und Transporteure finden.",
    images: [
      {
        url: "/images/dashboard-main.png",
        width: 1200,
        height: 630,
        alt: "CargoBit digitale Logistikplattform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CargoBit | Digitale Transportplattform mit KI-Preisrechner",
    description:
      "Berechnen Sie realistische Transportpreise und finden Sie passende Speditionen, Fahrer und Transporteure.",
    images: ["/images/dashboard-main.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider>
          {children}
          <div className="fixed bottom-4 right-4 z-50">
            <ThemeToggle />
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
