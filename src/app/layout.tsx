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
  description: "Petar Juric specializes in data visualization, large-scale data pipelines, and real-time systems. Currently contracted at Apple; previously at Ericsson.",
  metadataBase: new URL("https://juric.dev"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Petar Juric | Software Engineer",
    description: "Data visualization, large-scale data pipelines, and real-time systems. Software engineer currently contracted at Apple, with RTOS experience at Ericsson.",
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
