import { Badge } from "@/components/ui";
import { teamRun, type RunStatus } from "@/engine/competitions/run";
import type { Competition } from "@/engine/types";

const TONE: Record<RunStatus, "pitch" | "coral" | "sun" | "paper"> = { alive: "pitch", eliminated: "coral", won: "sun", none: "paper" };

/** One line saying how far the user's side got, shown even after they are knocked out. */
export function RunBadge({ comp, teamId }: { comp: Competition; teamId: string }) {
  const run = teamRun(comp, teamId);
  if (run.status === "none") return null;
  return <Badge tone={TONE[run.status]}>{run.status === "won" ? "🏆 " : ""}{run.text}</Badge>;
}
