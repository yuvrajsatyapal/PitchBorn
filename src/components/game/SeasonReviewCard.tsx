import { Card, LinkButton } from "@/components/ui";
import { seasonLabel } from "@/engine/calendar";
import { reviewAvailable, seasonReview } from "@/engine/career/seasonReview";
import type { GameState } from "@/engine/types";

/** Dashboard, from the end of the league season to the next one: a way into the season review. */
export function SeasonReviewCard({ g }: { g: GameState }) {
  if (!reviewAvailable(g)) return null;
  const r = seasonReview(g);
  return (
    <Card tone="sky" title={`📋 ${seasonLabel(r.season)} in review`} action={<LinkButton href="/play/review" size="sm" tone="paper">Open</LinkButton>}>
      <p className="text-sm">{r.verdict} {r.apps} games, {r.goals} goals, {r.assists} assists{r.avgRating ? `, average ${r.avgRating.toFixed(2)}` : ""}.</p>
    </Card>
  );
}
