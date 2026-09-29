import type { Metadata } from "next";
import { JetBrains_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Petar Juric | Software Engineer",
  description: "Building high-volume data ingestion pipelines across Apple’s engineering teams on contract. Previously worked on real-time 5G and 6G systems at Ericsson.",
  metadataBase: new URL("https://juric.dev"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Petar Juric | Software Engineer",
    description: "Building high-volume data ingestion pipelines across Apple’s engineering teams on contract. Previously worked on real-time 5G and 6G systems at Ericsson.",
    url: "https://juric.dev",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jetbrainsMono.variable} ${plexSans.variable} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
