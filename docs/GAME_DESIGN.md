# Game design

**Pillars:** one career, a living world, consequential choices, honest numbers.

## Career arc
Youth/academy → first contract → development squad / loans → debut → breakthrough → transfers → bigger clubs → national team → trophies & awards → prime (position-dependent peak age ~27–31) → decline → retirement → legacy.

## Core loop (one week = one turn, 50 turns per season)
- Turns 1–3 pre-season · 4–43 season (league rounds, cups, continental nights, 4 international windows) · 44 season finale (awards, promotion/relegation decided) · 45–50 summer (even-year summers host a 16-team World Championship or European Nations Championship) → rollover (contracts end on 30 June).
- Transfer windows follow real dates (turn 1 = 1 July, a turn = a week): summer 1 Jul–31 Aug (turns 1–9) and January 1–31 Jan (turns 28–31). Nobody under contract moves outside them; free agents can sign at any time, and renewals can be agreed whenever.
- Each week: training plan → user's matches (live or sim) → world simulates → development, finances, transfers, offers, random events, news.

## Starting out
Your starting ability depends only on the path, never on the club: academy prospect ≈61 overall (age 17, hidden potential ~89), late starter ≈67 (age 20, potential ~85). The club decides the environment instead: elite clubs mean little early game time (development squad, loans) but better facilities, reputation and wages; smaller clubs mean early minutes, which drive development. The club picker shows each squad's level against your start. A **Playstyle** step lets you pick a *desired playstyle* for your position (or No preference): a small, fading lean to your early development and starting attributes at no cost to your overall, never a trait. See `docs/TRAITS.md`.

## Player model
Visible attributes (1–99): pace, acceleration, stamina, strength, finishing, long shots, passing, vision, crossing, dribbling, first touch, tackling, positioning, heading, composure, plus GK reflexes, handling, diving, kicking, command. Overall is a position-weighted blend.
Hidden: potential, consistency, professionalism, ambition, loyalty, injury proneness, adaptability, big-match temperament, development rate, personal peak age. Hidden values surface only as scouting stars and personality traits.

## Systems
- **Development** – monthly ticks; growth scales with age, gap to potential, minutes, club facilities/manager, professionalism, morale, form, a per-season swing (breakthrough or stagnant years) and training. Decline starts after the personal peak, physical attributes first.
- **Training** – focus (finishing, passing, dribbling, speed, physical, defending, set pieces, goalkeeping, recovery) × intensity (light/normal/intense). Normal is the neutral point; intense gives a small edge (≈+7% monthly growth plus slightly bigger drill gains) at a real cost: −10 fitness a week and ×2.2 training-injury risk, rising to ×2 more (overload) after three intense weeks in a row. Drill gains shrink as you approach your potential.
- **Playing vs training** – playing is the biggest growth driver. Monthly growth runs from ×0.55 (never used) to ×1.45 (ever-present), recent form adds up to ±15%, and every match gives direct "match experience" scaled by minutes and rating (nothing below 5.8, most for 7.5+). A regular who plays well grows roughly twice as fast as a bench player who trains intensely.
- **Matches** – event-based engine (see SIMULATION.md). Selection depends on ability, condition, form and the manager relationship.
- **Development squad** – under-21s left out of the matchday squad play abstracted U21 games that keep them sharp.
- **Transfers & contracts** – interest from clubs that need your position at your level; bids, club acceptance/rejection, improved bids, release clauses (Spain), personal-terms negotiation with patience, loans, renewals, free agency, transfer requests.
- **Fitness** – a full match costs ~12–15 (less with high stamina) and a normal week recovers ~20, so regular starters sit around 85–95. Two-match weeks and intense training pull it down (to the 60s–70s with intense work); performance tails off below ~90 and injury risk rises below 70. Players can use a Recovery training week or **ask to be rested** before a match day: they miss that week's club games and recover +12, but the manager relationship dips (more if they already looked fresh). Tunables live in `BALANCE.fitness`.
- **Form / morale / sharpness** – feed match performance; playing time vs. role expectations drives morale.
- **Agents & money** – wages, bonuses and sponsorships go into a **bank balance** (career earnings stays as a lifetime stat). The agent market (`src/engine/career/agents.ts`) has 14 generated agents in four tiers (Rookie 30–50, Established 50–70, Top 70–85, Super 85+). Each has four skills — Negotiation (wage ceilings, signing bonuses), Connections (offer volume), Media (reputation growth, sponsorships), Player care (morale, loan searches) — one specialty and one weak spot. Cost: a weekly retainer (≈ €100 for a rookie, ≈ €2k for a 72, ≈ €10k+ for a super-agent) plus a 3–8% commission on each new contract's signing bonus and first-year wages. Top agents require reputation (45/65, 15 less for under-21s with potential ≥ 88), you need 4 weeks of fees in the bank, and you can change agent once a season. Four unpaid weeks and the agent leaves. You can always go without one. Tunables: `BALANCE.agents`.
- **Contracts** – `contract.expires` is the last season covered; a player becomes a free agent only after that season ends. Renewals add their years to the existing deal (never shorten it). Clubs only make offers within a few points of your level (a bit more leeway for free agents and veterans).
- **Football Memory** – debuts, derby winners, late goals, hat-tricks, finals, trophies, awards, big and controversial moves, comebacks, relegations and the final match are detected, scored 0–100 from context and kept for the Iconic Moments page. See MEMORY.md.
- **Injuries** – knocks to ACLs with recovery times, lasting pace loss for the worst; capped at one serious injury per user season to avoid frustration. Sources: challenges in matches, non-contact match injuries (per 90 minutes, scaled by proneness and low fitness) and training (scaled by intensity, overload, proneness and fitness). A typical regular picks up ~1 time-loss injury a season on normal training; non-stop intense work roughly doubles that.
- **Reputation & relationships** – domestic and international reputation; manager, teammates, supporters, board, agent.
- **National teams** – 41 nations, squads chosen by ability/form/reputation; dual eligibility until a competitive cap; friendlies/qualifiers each window; summer tournaments; international retirement.
- **Awards** – Player of the Match, Team of the Week, Player of the Month, Player/Young Player of the Season, Golden Boot, Playmaker, Golden Glove, Team of the Season, Golden Pitch (world), Rising Star (U21), World Goalkeeper.
- **Events** – restrained (≈11% chance per week, per-event cooldowns): pundits, media criticism, dressing-room bust-ups, sponsors, captaincy, illness, family, super-agents…
- **Legacy** – appearances, goals/assists/clean sheets, trophies (weighted), awards, caps, peak ability, longevity, loyalty, reputation, records → tier from *Journeyman Pro* to *All-Time Great*, plus detected stories (Wonderkid, Late Bloomer, One-Club Legend, Journeyman, Injury Comeback, Superstar, Failed Prospect, International Hero, Lower-League Rise, Veteran Leader).

## Original branding
Domestic leagues and cups use their factual names. Continental and international competitions and all awards are Pitchborn originals (Champions Cup, Continental Cup, World Championship, European Nations Championship, Golden Pitch).
