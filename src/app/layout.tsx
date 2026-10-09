import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Lilita_One, Outfit } from "next/font/google";
import { Providers } from "@/components/app/Providers";
import "./globals.css";

const lilita = Lilita_One({ weight: "400", subsets: ["latin"], variable: "--font-lilita", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const chakra = Chakra_Petch({ weight: ["600", "700"], subsets: ["latin"], variable: "--font-chakra", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Pitchborn — Football Career Simulator", template: "%s · Pitchborn" },
  description: "Live an entire footballer's career — from academy prospect to retirement legend — in a deep, free browser simulation built on real clubs and leagues.",
  applicationName: "Pitchborn",
  appleWebApp: { capable: true, title: "Pitchborn", statusBarStyle: "default" },
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
    <html lang="en" className={`${lilita.variable} ${outfit.variable} ${chakra.variable} h-full antialiased`} suppressHydrationWarning>
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
