"use client";
import { useState } from "react";
import { AD_RULES } from "./config";
import { useAds } from "./AdContext";

/**
 * Optional rewarded ad. Hidden when the provider can't verify completions.
 * `onReward` runs only after a verified completion event — never on skip/failure.
 */
export function RewardedButton({ label, onReward, disabled, hint }: { label: string; onReward: () => boolean; disabled?: boolean; hint?: string }) {
  const { provider, ready } = useAds();
  const [state, setState] = useState<"idle" | "playing" | "done" | "failed">("idle");
  if (!AD_RULES.rewarded.enabled || !ready || !provider.supportsRewarded()) return null;
  const run = async () => {
    setState("playing");
    try {
      const r = await provider.showRewarded();
      if (r.completed && r.verified && onReward()) setState("done");
      else setState("failed");
    } catch {
      setState("failed");
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <button disabled={disabled || state === "playing" || state === "done"} onClick={run} className="pb-btn bg-plum-2 px-3 text-sm min-h-[36px]">
        {state === "playing" ? "Playing ad…" : state === "done" ? "Bonus applied ✓" : `▶ ${label}`}
      </button>
      <span className="text-[11px] text-muted">{state === "failed" ? "Ad unavailable — no bonus applied." : hint ?? "Optional · watch a short ad"}</span>
    </div>
  );
}
