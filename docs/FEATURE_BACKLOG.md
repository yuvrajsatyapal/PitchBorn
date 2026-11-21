# Feature Backlog

Ideas for what to add next. Build them only when the owner says to start one.

## Built (November 2026)

- **Achievements and trophies** (#10): `engine/career/achievements.ts`, `/play/achievements`.
- **Shareable career card** (#11): `engine/career/card.ts`, `components/game/CareerCard.tsx`, `/play/card`.
- **First-season tips** (#15, as contextual tips rather than a guided week): `engine/career/tips.ts`, `components/game/TipCard.tsx`.
- **Loan advice for academy players** (#9): `engine/career/loanAdvice.ts`, `components/game/LoanAdviceCard.tsx`.
- **Press conferences** (#2, first half): `engine/career/press.ts`, `/play/press`.
- **Social feed** (#2, second half): `engine/career/feed.ts`, `/play/feed`.
- **Teammate chemistry** (#5): `engine/career/chemistry.ts`, Dressing Room card on the Club page.
- **Coaching career** (#1): `engine/career/coaching.ts`, `/play/coach`.

The numbered list below is the original backlog; the items above are done.

Already in the game: match engine with key moments and substitutions, training, transfers, contracts, loans, national team, awards and the gala, rivalries, memories, legacy, appearance editor, decisions, simulation.

## Big features (new ways to play)

1. **Coaching or manager career after retirement.** Keep the same save going as a youth coach, then an assistant, then a manager. The code has nothing for coaching yet.
2. **Press conferences and a social feed.** Before or after a match, answer a few questions. The answers change morale, fan opinion and the manager's rating of the player. A fake feed of fan and journalist posts reacts to games.
3. **Lifestyle and money.** Give wages something to buy: houses, cars, charity work, investments. Each has small effects, like better rest or a better reputation.
4. **Real sponsorship deals.** Turn sponsors into contracts with goals (for example "score 10 goals for a bonus"). The sponsor drops the player if form falls.

## Deeper football systems

5. **Teammate chemistry.** Partnerships with certain teammates that improve link-up on the pitch. Friends and rivals in the dressing room. Builds on the basic mentors that already exist.
6. **Set-piece specialist roles.** Become the team's penalty or free-kick taker, with interactive moments for those kicks.
7. **Weather and pitch conditions.** Rain, heat and snow change fatigue, passing and injury risk. **V1 in progress**: see `WEATHER.md`.
8. **Agent personality.** Give the existing agents a style (greedy, loyal, well connected). Let the player fire and hire agents.
9. **Loan advice for academy players.** Young players at elite clubs rarely play, so the UI should suggest a loan. This is already in the known issues in `PROJECT_STATE.md`.

## Retention and sharing

10. **Achievements and trophies.** For example "Hat-trick on debut" or "Won the league with 3 clubs".
11. **Shareable career card.** An image of the player's portrait, stats and trophies that people can post. Helps grow the site, which is on Vercel only.
12. **Challenge scenarios.** For example "Start at 17 in a third-tier league and win the Champions Cup by 25". Could also be a challenge seed that changes every week.
13. **Hall of Fame.** One place that shows retired players from every save.

## Polish

14. **Sound.** Crowd noise, the whistle and goal stings, with a mute toggle. There's no audio yet.
15. **Tutorial for the first season.** A short guided first week for new players. There's no onboarding flow yet.
16. **Ad and sponsor slot.** Still pending from earlier deployment notes (see `ADVERTISING.md`).

## Suggested starting points

- If the goal is people playing for longer: **#1, the coaching career**.
- If the goal is people coming back and sharing: **#2 press and social feed plus #11 the share card**.
