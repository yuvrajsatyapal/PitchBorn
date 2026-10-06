"use client";
import { useEffect, type ReactNode } from "react";
import { AdProviderRoot } from "@/ads/AdContext";
import { ConsentBanner } from "@/ads/ConsentBanner";
import { Toaster } from "./Toaster";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return (
    <AdProviderRoot>
      <div className="relative z-[1]">{children}</div>
      <Toaster />
      <ConsentBanner />
    </AdProviderRoot>
  );
}
