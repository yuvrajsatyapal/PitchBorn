import type { FeedPost } from "@/engine/types";
import { seasonLabel } from "@/engine/calendar";

const KIND: Record<FeedPost["kind"], { label: string; bg: string; icon: string }> = {
  fan: { label: "Fan", bg: "bg-sun", icon: "🙋" },
  "rival-fan": { label: "Rival fan", bg: "bg-coral", icon: "😤" },
  journalist: { label: "Journalist", bg: "bg-sky", icon: "📰" },
  pundit: { label: "Pundit", bg: "bg-plum", icon: "🎧" },
  club: { label: "Official", bg: "bg-pitch", icon: "✅" },
  teammate: { label: "Teammate", bg: "bg-pitch", icon: "🤝" },
};

const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

export function FeedPostCard({ post, now }: { post: FeedPost; now?: { season: number; turn: number } }) {
  const k = KIND[post.kind] ?? KIND.fan;
  const ago = now && now.season === post.season ? (now.turn - post.turn <= 0 ? "this week" : `${now.turn - post.turn}w`) : seasonLabel(post.season);
  return (
    <li className="flex gap-3 rounded-2xl border-2 border-line/20 bg-card px-3 py-2.5" data-testid="feed-post">
      <span aria-hidden className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-line text-lg ${k.bg}`}>{k.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-x-2 text-sm">
          <span className="min-w-0 font-bold">{post.author}</span>
          <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-muted">{k.label}</span>
        </div>
        <div className="flex min-w-0 items-baseline gap-x-1.5 text-xs text-muted">
          <span className="min-w-0 truncate">{post.handle}</span>
          <span className="shrink-0 whitespace-nowrap">· {ago}</span>
        </div>
        <p className="mt-0.5 break-words text-[15px] leading-snug">{post.text}</p>
        <div className="mt-1.5 flex gap-4 text-xs text-muted" aria-label={`${post.likes} likes, ${post.reposts} reposts`}>
          <span>🔁 {compact(post.reposts)}</span>
          <span>♥ {compact(post.likes)}</span>
        </div>
      </div>
    </li>
  );
}
