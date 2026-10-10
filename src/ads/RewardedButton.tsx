"use client";
import { useState } from "react";
import { AD_RULES, PORTFOLIO_URL } from "./config";

/**
 * Optional boost. Clicking opens the developer's portfolio in a new tab and
 * grants the reward. `onReward` returns false when the boost is refused (cooldown).
 */
export function RewardedButton({ label, onReward, disabled, hint }: { label: string; onReward: () => boolean; disabled?: boolean; hint?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  if (!AD_RULES.rewarded.enabled) return null;
  const run = () => {
    // Opened synchronously inside the click so popup blockers allow it.
    window.open(PORTFOLIO_URL, "_blank", "noopener,noreferrer");
    setState(onReward() ? "done" : "failed");
  };
  return (
    <div className="flex flex-col gap-1">
      <button disabled={disabled || state === "done"} onClick={run} className="pb-btn bg-plum-2 px-3 text-sm min-h-[36px]">
        {state === "done" ? "Bonus applied ✓" : `▶ ${label}`}
      </button>
      <span className="text-[11px] text-muted">{state === "failed" ? "Boost unavailable — no bonus applied." : hint ?? "Optional · opens my portfolio"}</span>
    </div>
  );
}
