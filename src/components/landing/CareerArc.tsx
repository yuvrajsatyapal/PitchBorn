import { Kit } from "@/components/art/Kit";

const STEPS: { label: string; note: string }[] = [
  { label: "Academy", note: "Learn and develop" },
  { label: "Debut", note: "First team minutes" },
  { label: "Breakthrough", note: "Find your place" },
  { label: "Transfer", note: "Move clubs" },
  { label: "Champion", note: "Win trophies" },
  { label: "International", note: "Represent your country" },
  { label: "Prime", note: "Peak years" },
  { label: "Decline", note: "The body slows" },
  { label: "Legacy", note: "Be remembered" },
];

// Snake layout below lg: row 2 runs right-to-left so step 4 sits under step 3.
const COL_START = ["col-start-1", "col-start-2", "col-start-3", "col-start-3", "col-start-2", "col-start-1"];
const ROW_START = ["row-start-1", "row-start-2", "row-start-3"];

export function CareerArc({ kitClubId }: { kitClubId?: string }) {
  return (
    <section id="career" aria-labelledby="arc-title" className="pb-card scroll-mt-24 overflow-hidden p-4 sm:p-6 lg:p-7">
      <div className="flex flex-col items-start gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:gap-4 sm:gap-6">
        <div className="flex shrink-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/landing/captain-portrait.png"
            width={61}
            height={72}
            alt=""
            draggable={false}
            className="h-[72px] w-auto rounded-lg border-2 border-line shadow-[2px_2px_0_var(--shadow)]"
          />
          <Kit clubId={kitClubId} number={10} size={72} color="#3f9d5a" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="arc-title" className="font-display text-2xl leading-tight sm:text-3xl">
            The arc of a career
          </h2>
          <p className="mt-1 text-sm text-ink-2">From academy prospect to retired legend — every career finds its own route.</p>
        </div>
        <picture className="hidden shrink-0 lg:block">
          <source type="image/avif" srcSet="/images/career/arc-stadium.avif" />
          <img
            src="/images/career/arc-stadium.webp"
            width={480}
            height={270}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-24 w-auto rounded-xl border-2 border-line shadow-[2px_2px_0_var(--shadow)] xl:h-28"
          />
        </picture>
      </div>

      <ol className="mt-6 grid grid-cols-3 gap-x-2 gap-y-8 lg:grid-cols-9 lg:gap-x-0 lg:gap-y-0">
        {STEPS.map((s, i) => {
          const last = i === STEPS.length - 1;
          const reversed = Math.floor(i / 3) === 1;
          const rowEnd = i % 3 === 2;
          return (
            <li key={s.label} className={`relative flex flex-col items-center text-center lg:col-start-auto lg:row-start-auto ${ROW_START[Math.floor(i / 3)]} ${COL_START[i % 3 + (reversed ? 3 : 0)]}`}>
              <span className="num relative z-10 grid h-9 w-9 place-items-center rounded-full border-2 border-line bg-sun text-[15px] text-[#1b1712] shadow-[2px_2px_0_var(--shadow)]">{i + 1}</span>
              {!last && !rowEnd && (
                <span
                  aria-hidden
                  className={`absolute top-[17px] items-center ${
                    reversed
                      ? "right-[calc(50%+26px)] left-[calc(-50%+18px)] flex-row-reverse max-lg:flex lg:left-[calc(50%+26px)] lg:right-[calc(-50%+26px)] lg:flex lg:flex-row"
                      : "left-[calc(50%+26px)] right-[calc(-50%+18px)] flex lg:right-[calc(-50%+26px)]"
                  }`}
                >
                  <span className="h-0.5 flex-1 bg-line" />
                  <span
                    className={`border-y-[5px] border-y-transparent ${
                      reversed
                        ? "-mr-px border-r-[7px] border-r-[var(--line)] lg:-ml-px lg:mr-0 lg:border-l-[7px] lg:border-r-0 lg:border-l-[var(--line)]"
                        : "-ml-px border-l-[7px] border-l-[var(--line)]"
                    }`}
                  />
                </span>
              )}
              {!last && rowEnd && (
                <>
                  <span aria-hidden className="absolute left-1/2 top-[calc(100%+6px)] flex h-[18px] -translate-x-1/2 flex-col items-center lg:hidden">
                    <span className="w-0.5 flex-1 bg-line" />
                    <span className="-mt-px border-x-[5px] border-t-[7px] border-x-transparent border-t-[var(--line)]" />
                  </span>
                  <span aria-hidden className="absolute left-[calc(50%+26px)] right-[calc(-50%+26px)] top-[17px] hidden items-center lg:flex">
                    <span className="h-0.5 flex-1 bg-line" />
                    <span className="-ml-px border-y-[5px] border-l-[7px] border-y-transparent border-l-[var(--line)]" />
                  </span>
                </>
              )}
              <span className="mt-2 text-[13px] font-extrabold leading-tight sm:text-sm">{s.label}</span>
              <span className="mt-0.5 hidden max-w-[7.5rem] text-pretty text-xs leading-snug text-ink-2 sm:block">{s.note}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
