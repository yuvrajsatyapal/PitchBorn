import type { ComponentType } from "react";
import { ContractIcon, GlobeIcon, PadIcon } from "./icons";

const FEATURES: { title: string; body: string; tone: string; Icon: ComponentType<{ className?: string }> }[] = [
  {
    title: "A living football world",
    body: "Five real football pyramids, cups, continental nights and summer tournaments. Thousands of players age, develop, transfer and retire around you.",
    tone: "bg-pitch-2",
    Icon: GlobeIcon,
  },
  {
    title: "A match engine with decisions",
    body: "Every match is simulated phase by phase. When the ball falls to you, you choose: shoot, take a touch, or square it.",
    tone: "bg-sky-2",
    Icon: PadIcon,
  },
  {
    title: "Choices that shape a career",
    body: "Loans, bids, contract talks, agents, managers, fans. Stay loyal, chase trophies or follow the money — and live with it.",
    tone: "bg-plum-2",
    Icon: ContractIcon,
  },
];

export function FeatureCards() {
  return (
    <section id="features" aria-label="Features" className="grid scroll-mt-24 gap-4 md:grid-cols-3">
      {FEATURES.map(({ title, body, tone, Icon }) => (
        <article
          key={title}
          className={`pb-card group flex items-start gap-4 p-4 transition-[transform,box-shadow] duration-200 sm:p-5 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[6px_6px_0_var(--shadow)] md:flex-col md:gap-5 lg:p-6 ${tone}`}
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-2 border-line bg-card text-ink shadow-[2px_2px_0_var(--shadow)] transition-transform duration-200 motion-safe:group-hover:-rotate-6 md:h-16 md:w-16">
            <Icon className="h-9 w-9 md:h-10 md:w-10" />
          </span>
          <div>
            <h2 className="font-display text-xl leading-tight sm:text-2xl">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2 md:mt-2 md:text-[0.95rem]">{body}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
