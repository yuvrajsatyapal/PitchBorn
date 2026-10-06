"use client";
import { useEffect, useState } from "react";

export function OfflineBadge() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const up = () => setOffline(!navigator.onLine);
    up();
    window.addEventListener("online", up);
    window.addEventListener("offline", up);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", up);
    };
  }, []);
  if (!offline) return null;
  return <span className="rounded-full border-2 border-line bg-sun-2 px-2 py-0.5 text-[11px] font-bold">Offline · saves are local</span>;
}
