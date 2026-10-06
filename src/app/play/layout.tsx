import { GameShell } from "@/components/app/GameShell";

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <GameShell>{children}</GameShell>;
}
