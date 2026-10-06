export interface NavItem {
  href: string;
  label: string;
  icon: string;
  mobile?: boolean;
}

export const NAV: NavItem[] = [
  { href: "/play", label: "Dashboard", icon: "🏠", mobile: true },
  { href: "/play/match", label: "Match Day", icon: "⚽", mobile: true },
  { href: "/play/schedule", label: "Schedule", icon: "📅" },
  { href: "/play/profile", label: "My Player", icon: "🧍", mobile: true },
  { href: "/play/training", label: "Training", icon: "🏋️" },
  { href: "/play/club", label: "Club & Squad", icon: "🛡️" },
  { href: "/play/league", label: "Competitions", icon: "🏆" },
  { href: "/play/transfers", label: "Career & Contract", icon: "✍️", mobile: true },
  { href: "/play/national", label: "National Team", icon: "🌍" },
  { href: "/play/stats", label: "Statistics", icon: "📊" },
  { href: "/play/awards", label: "Awards", icon: "🥇" },
  { href: "/play/history", label: "History & Records", icon: "📜" },
  { href: "/play/world", label: "World News", icon: "📰" },
  { href: "/play/settings", label: "Settings & Saves", icon: "⚙️" },
];
