"use client";
import { useSyncExternalStore } from "react";
import { onSoundChange, setSoundEnabled, soundEnabled } from "@/audio/sound";
import { Button } from "@/components/ui";

/** Mute / unmute for match sound. Off by default; remembered per browser. */
export function SoundToggle({ size = "sm" }: { size?: "sm" | "md" }) {
  const on = useSyncExternalStore(onSoundChange, soundEnabled, () => false);
  return (
    <Button size={size} tone="paper" aria-pressed={on} aria-label={on ? "Mute match sound" : "Turn match sound on"} onClick={() => setSoundEnabled(!on)} data-testid="sound-toggle" className="shrink-0 whitespace-nowrap">
      {on ? "🔊 Sound on" : "🔇 Sound off"}
    </Button>
  );
}
