import type { Metadata, Viewport } from "next";
import { Caveat, Chakra_Petch, Lilita_One, Outfit } from "next/font/google";
import { Providers } from "@/components/app/Providers";
import "./globals.css";

const lilita = Lilita_One({ weight: "400", subsets: ["latin"], variable: "--font-lilita", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const chakra = Chakra_Petch({ weight: ["600", "700"], subsets: ["latin"], variable: "--font-chakra", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });

export const metadata: Metadata = {
  title: { default: "PitchBorn — Football Career Simulator", template: "%s · PitchBorn" },
  description: "Live an entire footballer's career — from academy prospect to retirement legend — in a deep, free browser simulation built on real clubs and leagues.",
  applicationName: "PitchBorn",
  appleWebApp: { capable: true, title: "PitchBorn", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff5e6" },
    { media: "(prefers-color-scheme: dark)", color: "#17140f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lilita.variable} ${outfit.variable} ${chakra.variable} ${caveat.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('pb-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="relative min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
