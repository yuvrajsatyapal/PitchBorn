"use client";
import { useState } from "react";
import { Flag } from "@/components/art/Flag";
import { Badge, Bar, Button, Card, Modal } from "@/components/ui";
import { AGENT_SKILL_LABEL, AGENT_TIER_LABEL, agentMarket, canHireAgent, requiredReputation } from "@/engine/career/agents";
import { formatMoney } from "@/engine/players/economy";
import type { Agent, AgentSkills, GameState } from "@/engine/types";
import { useGame } from "@/game/store";

const SKILLS = Object.keys(AGENT_SKILL_LABEL) as (keyof AgentSkills)[];
const TIER_TONE = { none: "paper", rookie: "paper", established: "sky", top: "plum", super: "sun" } as const;

function SkillBars({ agent }: { agent: Agent }) {
  return (
    <div className="grid gap-1.5">
      {SKILLS.map((k) => (
        <Bar key={k} label={AGENT_SKILL_LABEL[k].label + (agent.specialty === k ? " ★" : "")} value={agent.skills[k]} tone={agent.specialty === k ? "sun" : "pitch"} height={8} />
      ))}
    </div>
  );
}

function Costs({ agent }: { agent: Agent }) {
  return (
    <div className="text-sm">
      <b>{formatMoney(agent.weeklyFee)}</b>/wk · <b>{(agent.commission * 100).toFixed(1)}%</b> of each new contract
    </div>
  );
}

export function AgentPanel({ g }: { g: GameState }) {
  const hire = useGame((s) => s.hireAgent);
  const release = useGame((s) => s.releaseAgent);
  const [open, setOpen] = useState(false);
  const me = g.user.agent;
  const none = me.id === "none";
  const market = agentMarket(g);
  const weeks = me.weeklyFee ? Math.floor(g.user.bank / me.weeklyFee) : null;
  return (
    <>
      <Card title="Agent" action={<Badge tone={TIER_TONE[me.tier]}>{AGENT_TIER_LABEL[me.tier]}</Badge>}>
        <div className="flex items-center gap-2 text-lg font-bold">
          {me.nationality && <Flag code={me.nationality} />} {me.name}
        </div>
        {none ? (
          <p className="mt-1 text-xs text-muted">You represent yourself: no fees, but fewer offers and weaker terms.</p>
        ) : (
          <>
            <div className="mt-1 text-xs text-ink-2">Rating {me.rating}/100 · relationship {Math.round(g.user.relationships.agent)}</div>
            <div className="mt-2"><SkillBars agent={me} /></div>
            <div className="mt-2"><Costs agent={me} /></div>
          </>
        )}
        <div className="mt-2 text-xs text-ink-2" data-testid="bank">
          Bank: <b>{formatMoney(g.user.bank)}</b>
          {weeks !== null && ` · covers ${weeks} week${weeks === 1 ? "" : "s"} of fees`}
        </div>
        {(g.user.agentUnpaidWeeks ?? 0) > 0 && <p className="mt-1 text-xs font-bold text-coral">Unpaid fees: {g.user.agentUnpaidWeeks} week(s). Your agent leaves after 4.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" tone="sun" onClick={() => setOpen(true)} data-testid="agent-market">Agent market</Button>
          {!none && <Button size="sm" tone="paper" onClick={release}>Go without agent</Button>}
        </div>
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Agent market">
        <p className="mb-3 text-xs text-ink-2">
          Fees come out of your bank every week, plus a commission on each new contract. You can change agent once a season. Top agents only take players with enough reputation (or rare potential).
        </p>
        <ul className="grid max-h-[60vh] gap-2 overflow-y-auto pr-1">
          {[...market].reverse().map((a) => {
            const check = canHireAgent(g, a);
            const current = me.id === a.id;
            return (
              <li key={a.id} className={`rounded-xl border-2 p-3 ${current ? "border-pitch bg-pitch-2/20" : "border-line"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold">
                    <Flag code={a.nationality} /> {a.name} <Badge tone={TIER_TONE[a.tier]}>{AGENT_TIER_LABEL[a.tier]}</Badge>
                    <span className="text-xs text-ink-2">{a.rating}</span>
                  </div>
                  <Button size="sm" tone={current ? "paper" : "pitch"} disabled={!check.ok} onClick={() => hire(a.id)}>
                    {current ? "Current agent" : "Hire"}
                  </Button>
                </div>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                  <SkillBars agent={a} />
                  <div>
                    <Costs agent={a} />
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
