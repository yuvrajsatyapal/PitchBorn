"use client";
import { useEffect, useState } from "react";
import { useGame } from "@/game/store";

export function Toaster() {
  const toast = useGame((s) => s.toast);
  if (!toast) return null;
  return <ToastItem key={toast.id} text={toast.text} tone={toast.tone} />;
}

function ToastItem({ text, tone: t }: { text: string; tone?: "good" | "bad" | "info" }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(id);
  }, []);
  if (!visible) return null;
  const toast = { text, tone: t };
  const tone = toast.tone === "good" ? "bg-pitch-2" : toast.tone === "bad" ? "bg-coral-2" : "bg-sun-2";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex justify-center px-3" role="status" aria-live="polite">
      <div className={`pb-card anim-pop pointer-events-auto max-w-md px-4 py-2.5 text-sm font-semibold ${tone}`}>{toast.text}</div>
    </div>
  );
}
