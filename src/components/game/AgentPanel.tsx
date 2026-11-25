"use client";
import { useState } from "react";
import { Flag } from "@/components/art/Flag";
import { Badge, Bar, Button, Card, Modal } from "@/components/ui";
import { AGENT_SKILL_LABEL, AGENT_STYLE_LABEL, AGENT_TIER_LABEL, agentMarket, agentPatience, agentStyle, canHireAgent, effectiveCommission, effectiveSkills, releaseCost, requiredReputation } from "@/engine/career/agents";
import { formatMoney } from "@/engine/players/economy";
import type { Agent, AgentSkills, AgentStyle, GameState } from "@/engine/types";
import { useGame } from "@/game/store";

const SKILLS = Object.keys(AGENT_SKILL_LABEL) as (keyof AgentSkills)[];
const TIER_TONE = { none: "paper", rookie: "paper", established: "sky", top: "plum", super: "sun" } as const;
const STYLE_TONE: Record<AgentStyle, "coral" | "pitch" | "sky"> = { greedy: "coral", loyal: "pitch", connected: "sky" };

/** Skills as they play out, personality included. */
function SkillBars({ g, agent }: { g: GameState; agent: Agent }) {
  const skills = effectiveSkills(g, agent);
  return (
    <div className="grid gap-1.5">
      {SKILLS.map((k) => (
        <Bar key={k} label={AGENT_SKILL_LABEL[k].label + (agent.specialty === k ? " ★" : "")} value={skills[k]} tone={agent.specialty === k ? "sun" : "pitch"} height={8} />
      ))}
    </div>
  );
}

function Costs({ g, agent }: { g: GameState; agent: Agent }) {
  return (
    <div className="text-sm">
      <b>{formatMoney(agent.weeklyFee)}</b>/wk · <b>{(effectiveCommission(g, agent) * 100).toFixed(1)}%</b> of each new contract
    </div>
  );
}

function StyleBadge({ g, agent }: { g: GameState; agent: Agent }) {
  const style = agentStyle(g, agent);
  return style ? <Badge tone={STYLE_TONE[style]}>{AGENT_STYLE_LABEL[style].label}</Badge> : null;
}

function StyleNote({ g, agent }: { g: GameState; agent: Agent }) {
  const style = agentStyle(g, agent);
  return style ? <p className="text-xs text-ink-2">{AGENT_STYLE_LABEL[style].blurb}</p> : null;
}

export function AgentPanel({ g }: { g: GameState }) {
  const hire = useGame((s) => s.hireAgent);
  const release = useGame((s) => s.releaseAgent);
  const [open, setOpen] = useState(false);
  const [firing, setFiring] = useState(false);
  const me = g.user.agent;
  const none = me.id === "none";
  const market = agentMarket(g);
  const weeks = me.weeklyFee ? Math.floor(g.user.bank / me.weeklyFee) : null;
  return (
    <>
      <Card className="flex flex-col" title="Agent" action={<Badge tone={TIER_TONE[me.tier]}>{AGENT_TIER_LABEL[me.tier]}</Badge>}>
        <div className="flex flex-wrap items-center gap-2 text-lg font-bold">
          {me.nationality && <Flag code={me.nationality} />} {me.name} <StyleBadge g={g} agent={me} />
        </div>
        {none ? (
          <p className="mt-1 text-xs text-muted">You represent yourself: no fees, but fewer offers and weaker terms.</p>
        ) : (
          <>
            <div className="mt-1 text-xs text-ink-2">Rating {me.rating}/100 · relationship {Math.round(g.user.relationships.agent)}</div>
            <div className="mt-1"><StyleNote g={g} agent={me} /></div>
            <div className="mt-2"><SkillBars g={g} agent={me} /></div>
            <div className="mt-2"><Costs g={g} agent={me} /></div>
          </>
        )}
        <div className="mt-2 text-xs text-ink-2" data-testid="bank">
          Bank: <b>{formatMoney(g.user.bank)}</b>
          {weeks !== null && ` · covers ${weeks} week${weeks === 1 ? "" : "s"} of fees`}
        </div>
        {(g.user.agentUnpaidWeeks ?? 0) > 0 && <p className="mt-1 text-xs font-bold text-coral">Unpaid fees: {g.user.agentUnpaidWeeks} week(s). Your agent leaves after {agentPatience(g, me)}.</p>}
        <div className={`mt-auto grid gap-2 pt-4 ${none ? "grid-cols-1" : "grid-cols-2"}`}>
          <Button size="sm" tone="sun" className="w-full whitespace-nowrap" onClick={() => setOpen(true)} data-testid="agent-market">Agent market</Button>
          {!none && <Button size="sm" tone="paper" className="w-full whitespace-nowrap" onClick={() => setFiring(true)}>Fire agent</Button>}
        </div>
      </Card>
      <Modal open={firing} onClose={() => setFiring(false)} title={`Fire ${me.name}?`}>
        <p className="text-sm">
          {releaseCost(g) ? <>Ending the contract costs <b>{formatMoney(releaseCost(g))}</b> in severance{agentStyle(g, me) === "greedy" ? ": greedy agents hold you to every week." : "."}</> : "Your agent lets you go without a fee."} You will represent yourself until you hire someone new{g.user.agentChangedSeason === g.season ? " (and you have already changed agent this season, so that waits until next season)" : ""}.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" tone="paper" onClick={() => setFiring(false)}>Keep him</Button>
          <Button size="sm" tone="coral" onClick={() => (release(), setFiring(false))} data-testid="confirm-fire-agent">Fire agent</Button>
        </div>
      </Modal>
      <Modal open={open} onClose={() => setOpen(false)} title="Agent market">
        <p className="mb-3 text-xs text-ink-2">
          Fees come out of your bank every week, plus a commission on each new contract. You can change agent once a season. Top agents only take players with enough reputation (or rare potential). Each agent has a way of working: greedy agents get more out of clubs but take a bigger cut, loyal ones charge less and stick by you, well-connected ones bring more offers.
        </p>
        <ul className="grid max-h-[60dvh] gap-2 overflow-y-auto pr-1">
          {[...market].reverse().map((a) => {
            const check = canHireAgent(g, a);
            const current = me.id === a.id;
            return (
              <li key={a.id} className={`rounded-xl border-2 p-3 ${current ? "border-pitch bg-pitch-2/20" : "border-line"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold">
                    <Flag code={a.nationality} /> {a.name} <Badge tone={TIER_TONE[a.tier]}>{AGENT_TIER_LABEL[a.tier]}</Badge> <StyleBadge g={g} agent={a} />
                    <span className="text-xs text-ink-2">{a.rating}</span>
                  </div>
                  <Button size="sm" tone={current ? "paper" : "pitch"} disabled={!check.ok} onClick={() => hire(a.id)}>
                    {current ? "Current agent" : "Hire"}
                  </Button>
                </div>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                  <SkillBars g={g} agent={a} />
                  <div>
                    <Costs g={g} agent={a} />
                    <div className="mt-1"><StyleNote g={g} agent={a} /></div>
                    {a.specialty && <div className="mt-1 text-xs text-ink-2">Best at {AGENT_SKILL_LABEL[a.specialty].label.toLowerCase()}: {AGENT_SKILL_LABEL[a.specialty].blurb.toLowerCase()}.</div>}
                    {a.minReputation > 0 && !check.reason?.startsWith("Needs reputation") && <div className="mt-1 text-xs text-muted">Requires reputation {requiredReputation(g, a)}+</div>}
                    {!check.ok && !current && <div className="mt-1 text-xs font-bold text-coral">{check.reason}</div>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Modal>
    </>
  );
}
