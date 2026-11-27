"use client";
import { forwardRef } from "react";
import { PlayerPortrait } from "@/components/art/PlayerPortrait";
import type { CareerCardData } from "@/engine/career/card";
import type { Appearance } from "@/engine/types";

export const CARD_W = 1080;
export const CARD_H = 1350;

/** Fonts every browser has, so the exported image looks the same as the card on screen. */
const DISPLAY = "'Arial Rounded MT Bold', 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
const BODY = "'Helvetica Neue', Arial, sans-serif";
const INK = "#1b1712";
const CREAM = "#f6efdf";

/** Perceived lightness, to pick legible text on the club colour. */
function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

function initials(club: string): string {
  const words = club.replace(/[^A-Za-z ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["the", "and"].includes(w.toLowerCase()));
  return (words.length ? words.slice(0, 2).map((w) => w[0]) : [club[0] ?? "?"]).join("").toUpperCase();
}

/**
 * The career card as one self-contained SVG: no CSS variables, page fonts or external images,
 * so it can be serialised and drawn onto a canvas for download or sharing.
 */
export const CareerCard = forwardRef<SVGSVGElement, { d: CareerCardData; look: Appearance; footer?: string; className?: string }>(function CareerCard({ d, look, footer, className }, ref) {
  const bg = d.kitColors?.primary ?? d.clubColors.primary;
  const accent = d.kitColors?.secondary ?? d.clubColors.secondary;
  const onBg = isLight(bg) ? INK : "#ffffff";
  const nameSize = Math.min(104, Math.floor(1500 / Math.max(10, d.name.length)));
  // Fallback fonts run wider than the size estimate: squeeze a long name onto the plate rather than spill past it.
  const NAME_MAX_W = CARD_W - 160;
  const nameFit = d.name.length * nameSize * 0.62 > NAME_MAX_W ? NAME_MAX_W : undefined;
  const honours = d.honours.slice(0, 5);
  const extra = d.honours.length - honours.length;
  const awards = d.awards.slice(0, 3);
  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${CARD_W} ${CARD_H}`} width={CARD_W} height={CARD_H} className={className} role="img" aria-label={`Career card for ${d.name}`}>
      <rect width={CARD_W} height={CARD_H} fill={CREAM} />
      {/* Club-coloured top half with a hard offset frame, in the game's print style. */}
      <rect x="40" y="40" width={CARD_W - 80} height="700" rx="36" fill={INK} transform="translate(12 12)" />
      <rect x="40" y="40" width={CARD_W - 80} height="700" rx="36" fill={bg} stroke={INK} strokeWidth="6" />
      <circle cx={CARD_W - 150} cy="170" r="210" fill={accent} opacity="0.85" />
      <circle cx="150" cy="690" r="120" fill={accent} opacity="0.35" />
      <text x="84" y="118" fill={onBg} fontFamily={DISPLAY} fontSize="34" letterSpacing="6">PITCHBORN</text>
      <text x="84" y="160" fill={onBg} fontFamily={BODY} fontSize="26" fontWeight="700" opacity="0.85">{d.retired ? "CAREER CARD · RETIRED" : "CAREER CARD"}</text>

      {/* Overall badge */}
      <g transform="translate(84 196)">
        <rect width="170" height="170" rx="28" fill={INK} transform="translate(8 8)" />
        <rect width="170" height="170" rx="28" fill="#ffc62b" stroke={INK} strokeWidth="6" />
        <text x="85" y="108" textAnchor="middle" fill={INK} fontFamily={DISPLAY} fontSize="88">{d.retired ? d.peak : d.overall}</text>
        <text x="85" y="148" textAnchor="middle" fill={INK} fontFamily={BODY} fontWeight="800" fontSize="22">{d.retired ? "PEAK OVR" : "OVR"}</text>
      </g>
      <g transform="translate(84 400)">
        <rect width="170" height="64" rx="20" fill={CREAM} stroke={INK} strokeWidth="5" />
        <text x="85" y="44" textAnchor="middle" fill={INK} fontFamily={DISPLAY} fontSize="36">{d.position}</text>
      </g>
      {/* Club shield */}
      <g transform="translate(84 494)">
        <path d="M0 0 H170 V90 Q170 170 85 205 Q0 170 0 90 Z" fill={accent} stroke={INK} strokeWidth="6" />
        <path d="M22 22 H148 V88 Q148 150 85 178 Q22 150 22 88 Z" fill={bg} />
        <text x="85" y="118" textAnchor="middle" fill={isLight(bg) ? INK : "#fff"} fontFamily={DISPLAY} fontSize="54">{initials(d.club)}</text>
      </g>

      {/* Portrait */}
      <g transform="translate(330 150)">
        <defs>
          <clipPath id="pbcard-portrait" clipPathUnits="userSpaceOnUse">
            <circle cx="330" cy="300" r="297" />
          </clipPath>
        </defs>
        <circle cx="330" cy="300" r="300" fill={CREAM} />
        <g clipPath="url(#pbcard-portrait)">
          <g transform="translate(30 0)">
            <PlayerPortrait appearance={look} age={d.age} size={600} kit={{ primary: bg, secondary: accent }} background={CREAM} />
          </g>
        </g>
        <circle cx="330" cy="300" r="300" fill="none" stroke={INK} strokeWidth="6" />
      </g>

      {/* Name plate */}
      <rect x="40" y="770" width={CARD_W - 80} height="150" rx="28" fill={INK} />
      <text x={CARD_W / 2} y={770 + 82} textAnchor="middle" fill="#ffffff" fontFamily={DISPLAY} fontSize={nameSize} textLength={nameFit} lengthAdjust={nameFit ? "spacingAndGlyphs" : undefined}>{d.name}</text>
      <text x={CARD_W / 2} y={770 + 128} textAnchor="middle" fill="#ffc62b" fontFamily={BODY} fontWeight="700" fontSize="28">
        {d.positionLong} · {d.nation} · {d.club}
      </text>

      {/* Stats */}
      {d.stats.map((s, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 40 + col * 340;
        const y = 950 + row * 118;
        return (
          <g key={s.label} transform={`translate(${x} ${y})`}>
            <rect width="320" height="100" rx="22" fill="#ffffff" stroke={INK} strokeWidth="5" />
            <text x="24" y="62" fill={INK} fontFamily={DISPLAY} fontSize="48">{s.value}</text>
            <text x="296" y="60" textAnchor="end" fill="#6b6253" fontFamily={BODY} fontWeight="800" fontSize="22">{s.label.toUpperCase()}</text>
          </g>
        );
      })}

      {/* Honours */}
      <text x="60" y="1222" fill={INK} fontFamily={BODY} fontWeight="800" fontSize="24" letterSpacing="2">HONOURS</text>
      <text x="60" y="1258" fill={INK} fontFamily={BODY} fontWeight="700" fontSize="26">
        {honours.length ? `🏆 ${honours.join(" · ")}${extra > 0 ? ` +${extra}` : ""}` : awards.length ? `🎖 ${awards.join(" · ")}` : "The trophy cabinet is waiting."}
      </text>
      <text x="60" y="1300" fill="#6b6253" fontFamily={BODY} fontWeight="700" fontSize="22">
        {d.span} · {d.headline} · 🏅 {d.achievements.count}/{d.achievements.total} achievements
      </text>
      {footer && (
        <text x={CARD_W - 60} y="1222" textAnchor="end" fill="#6b6253" fontFamily={BODY} fontWeight="700" fontSize="22">{footer}</text>
      )}
    </svg>
  );
});

/** Draws the card SVG onto a canvas and returns a PNG. */
export async function cardToPng(svg: SVGSVGElement, scale = 1): Promise<Blob> {
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not draw the card."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = CARD_W * scale;
    canvas.height = CARD_H * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not export the card."))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}
