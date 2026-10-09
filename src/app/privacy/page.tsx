import type { Metadata } from "next";
import { PublicFooter, PublicHeader } from "@/components/app/PublicHeader";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="prose-sm mx-auto max-w-3xl px-4">
        <h1 className="mb-4 font-display text-4xl">Privacy</h1>
        <div className="pb-card grid gap-3 p-5 text-sm leading-relaxed">
          <p><b>No account, no server.</b> Pitchborn runs entirely in your browser. Your careers are stored locally in IndexedDB on this device and never uploaded by the game.</p>
          <p><b>Exports.</b> When you export a save, a file is created on your device. You decide where it goes.</p>
          <p><b>Preferences.</b> Theme and ad/sponsor choices are kept in your browser&apos;s local storage.</p>
          <p>
            <b>Ads &amp; sponsors.</b> This build may show clearly labelled ad / sponsor spaces. If the operator configures a third-party ad provider, that provider may set cookies or
            similar technologies. Personalised advertising is never loaded before you make a choice, and the game remains fully playable if you decline or block ads.
            Operators must configure a certified consent management platform where the law requires it.
          </p>
          <p><b>Analytics.</b> Pitchborn ships without analytics or tracking.</p>
          <p><b>Deleting data.</b> Delete careers from “My saves”, or clear this site&apos;s data in your browser settings.</p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
