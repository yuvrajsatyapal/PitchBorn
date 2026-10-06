import { adsenseClient, adsenseSlots, adProviderId, type AdPlacement } from "./config";
import type { ConsentState } from "./consent";

export type AdRenderResult = "filled" | "unfilled" | "blocked" | "error";

export interface RewardedResult {
  completed: boolean;
  /** True only when the provider confirmed completion (never simulated in production). */
  verified: boolean;
}

/** Provider-agnostic contract the UI talks to. */
export interface AdProvider {
  id: string;
  /** Real provider = shows third-party ads (needs consent handling). */
  real: boolean;
  init(consent: ConsentState): Promise<boolean>;
  render(el: HTMLElement, placement: AdPlacement): Promise<AdRenderResult>;
  destroy(el: HTMLElement): void;
  supportsRewarded(): boolean;
  showRewarded(): Promise<RewardedResult>;
}

class NoneProvider implements AdProvider {
  id = "none";
  real = false;
  async init() {
    return false;
  }
  async render(): Promise<AdRenderResult> {
    return "unfilled";
  }
  destroy() {}
  supportsRewarded() {
    return false;
  }
  async showRewarded() {
    return { completed: false, verified: false };
  }
}

/** Development/test provider: the slot shows a labelled placeholder. */
class PlaceholderProvider implements AdProvider {
  id = "placeholder";
  real = false;
  async init() {
    return true;
  }
  async render(): Promise<AdRenderResult> {
    return "filled";
  }
  destroy() {}
  supportsRewarded() {
    return true;
  }
  /** Simulated completion — only exists in the development provider. */
  async showRewarded(): Promise<RewardedResult> {
    await new Promise((r) => setTimeout(r, 1500));
    return { completed: true, verified: true };
  }
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** Google AdSense integration (inactive until env credentials are provided). */
class AdSenseProvider implements AdProvider {
  id = "adsense";
  real = true;
  private loaded: Promise<boolean> | null = null;
  private personalised = false;

  async init(consent: ConsentState): Promise<boolean> {
    const client = adsenseClient();
    if (!client || consent.status === "unknown") return false;
    this.personalised = consent.status === "granted" && consent.personalised;
    if (!this.loaded) {
      this.loaded = new Promise<boolean>((resolve) => {
        const s = document.createElement("script");
        s.async = true;
        s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
        s.crossOrigin = "anonymous";
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false); // ad blocker / offline
        document.head.appendChild(s);
      });
    }
    return this.loaded;
  }

  async render(el: HTMLElement, placement: AdPlacement): Promise<AdRenderResult> {
    const slot = adsenseSlots()[placement.id];
    const client = adsenseClient();
    if (!slot || !client) return "unfilled";
    if (!(await this.loaded)) return "blocked";
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", client);
    ins.setAttribute("data-ad-slot", slot);
    ins.setAttribute("data-ad-format", placement.format === "rail" ? "vertical" : "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    if (!this.personalised) ins.setAttribute("data-npa", "1");
    el.appendChild(ins);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      return "error";
    }
    return "filled";
  }

  destroy(el: HTMLElement) {
    el.innerHTML = "";
  }

  supportsRewarded() {
    // Web rewarded ads need a provider SDK with server-verified callbacks; not wired yet.
    return false;
  }

  async showRewarded() {
    return { completed: false, verified: false };
  }
}

let provider: AdProvider | null = null;
export function getAdProvider(): AdProvider {
  if (!provider) {
    const id = adProviderId();
    provider = id === "adsense" ? new AdSenseProvider() : id === "placeholder" ? new PlaceholderProvider() : new NoneProvider();
  }
  return provider;
}
