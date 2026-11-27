# Systems simulation: 192 player careers and 12 manager careers × 5 seasons

960 player-seasons and 32 manager-seasons (1854s). Autopilot plays; see the header of scripts/sim/systems.mts for the policies.

## Lifestyle: what a home costs

| Cohort | Careers | Wage at start (median) | Price level at start | City flat in weeks of wages | Sensible: first home after (weeks) |
| --- | --- | --- | --- | --- | --- |
| academy | 32 | €2K | 0.21 | 7.5 | 112 (16/16 bought one) |
| late-starter | 32 | €3K | 0.34 | 5.3 | 64 (16/16 bought one) |
| established | 32 | €36K | 0.92 | 1.8 | 8 (16/16 bought one) |
| star | 32 | €120K | 1.00 | 0.5 | 4 (16/16 bought one) |
| youth | 32 | €600 | 0.12 | 72.0 | 48 (16/16 bought one) |
| late-abroad | 32 | €3K | 0.30 | 5.2 | 64 (16/16 bought one) |

## Lifestyle: does money run out?

| Policy | Cohort | Seasons | Upkeep / wage (median) | Seasons with a forced sale | Bank at the end (median) | Net worth at the end (median) | Training injuries / season | Avg fitness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| frugal | academy | 40 | 0% | 0% | €2.6M | €2.6M | 0.55 | 85.6 |
| frugal | late-starter | 40 | 0% | 0% | €5.4M | €5.4M | 0.95 | 85.9 |
| frugal | established | 40 | 0% | 0% | €13.6M | €13.6M | 0.25 | 97.0 |
| frugal | star | 40 | 0% | 0% | €49.8M | €49.8M | 0.60 | 91.4 |
| frugal | youth | 40 | 0% | 0% | €149K | €149K | 0.88 | 89.4 |
| frugal | late-abroad | 40 | 0% | 0% | €3.9M | €3.9M | 0.70 | 89.2 |
| sensible | academy | 40 | 14% | 0% | €1.2M | €1.4M | 0.90 | 87.3 |
| sensible | late-starter | 40 | 15% | 0% | €2.6M | €3.0M | 0.50 | 87.0 |
| sensible | established | 40 | 16% | 0% | €7.5M | €8.3M | 0.33 | 98.3 |
| sensible | star | 40 | 15% | 0% | €26.9M | €30.2M | 0.57 | 93.0 |
| sensible | youth | 40 | 8% | 0% | €116K | €140K | 0.72 | 89.9 |
| sensible | late-abroad | 40 | 15% | 0% | €3.6M | €3.7M | 0.95 | 90.1 |
| lavish | academy | 40 | 63% | 50% | €118K | €249K | 0.95 | 88.5 |
| lavish | late-starter | 40 | 22% | 0% | €714K | €773K | 0.85 | 85.8 |
| lavish | established | 40 | 19% | 0% | €522K | €948K | 0.30 | 98.2 |
| lavish | star | 40 | 9% | 0% | €2.8M | €4.5M | 0.60 | 94.8 |
| lavish | youth | 40 | 88% | 85% | €2K | €3K | 0.82 | 90.6 |
| lavish | late-abroad | 40 | 36% | 0% | €175K | €307K | 0.80 | 91.1 |
| investor | academy | 40 | 15% | 0% | €594K | €1.0M | 0.78 | 87.4 |
| investor | late-starter | 40 | 16% | 0% | €1.6M | €2.7M | 1.00 | 86.7 |
| investor | established | 40 | 16% | 0% | €4.2M | €8.0M | 0.47 | 97.7 |
| investor | star | 40 | 13% | 0% | €15.4M | €30.9M | 0.60 | 95.6 |
| investor | youth | 40 | 8% | 5% | €73K | €132K | 0.63 | 90.0 |
| investor | late-abroad | 40 | 15% | 0% | €2.3M | €3.0M | 0.85 | 90.7 |

## Investments

| Kind | Yearly settlements | Mean return | Worst | Best | Years that lost money |
| --- | --- | --- | --- | --- | --- |
| bonds | 480 | 3.0% | 2% | 5% | 0% |
| property | 480 | 5.4% | -20% | 28% | 23% |
| startup | 192 | (settles once) | 104 went under | 88 paid off | 54% |

## Set pieces

Seasons for outfield players; "asks" careers ask the manager for both duties whenever they may.

| Position | Asks | Seasons | Took ≥1 penalty | Penalties / season | Scored | Held the penalty duty | Lost it | Free kicks / season | FK scored | Held the FK duty | Asked → granted |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ST | yes | 60 | 28% | 1.22 | 95% | 27% | 0% | 9.68 | 6% | 25% | 11/88 |
| ST | no | 60 | 10% | 0.23 | 86% | 0% | 0% | 0.02 | 0% | 0% | – |
| LW | yes | 60 | 18% | 0.77 | 74% | 17% | 5% | 3.98 | 7% | 7% | 5/111 |
| LW | no | 60 | 12% | 0.33 | 95% | 0% | 0% | 5.35 | 10% | 0% | – |
| AM | yes | 60 | 20% | 0.65 | 85% | 27% | 2% | 7.05 | 7% | 33% | 9/94 |
| AM | no | 60 | 12% | 0.38 | 83% | 0% | 0% | 5.98 | 5% | 0% | – |
| CM | yes | 60 | 25% | 1.12 | 76% | 27% | 5% | 22.88 | 7% | 35% | 16/90 |
| CM | no | 60 | 0% | 0.00 | – | 0% | 0% | 9.62 | 7% | 0% | – |
| DM | yes | 60 | 0% | 0.00 | – | 0% | 0% | 2.08 | 11% | 3% | 2/120 |
| DM | no | 60 | 0% | 0.00 | – | 0% | 0% | 0.28 | 0% | 0% | – |
| CB | yes | 60 | 0% | 0.00 | – | 0% | 0% | 3.32 | 7% | 15% | 2/114 |
| CB | no | 60 | 2% | 0.02 | 100% | 0% | 0% | 0.00 | – | 0% | – |
| RB | yes | 60 | 5% | 0.33 | 80% | 5% | 0% | 5.02 | 5% | 8% | 4/116 |
| RB | no | 60 | 0% | 0.00 | – | 0% | 0% | 0.00 | – | 0% | – |

| Cohort | Seasons (outfield) | Took ≥1 penalty | Never a penalty in the whole career | Penalties / season |
| --- | --- | --- | --- | --- |
| academy | 140 | 4% | 82% | 0.10 |
| late-starter | 140 | 13% | 71% | 0.43 |
| established | 140 | 5% | 86% | 0.24 |
| star | 140 | 26% | 61% | 1.07 |
| youth | 140 | 0% | 100% | 0.00 |
| late-abroad | 140 | 9% | 79% | 0.33 |

## Manager transfer market

| Tier | Seasons | Budget at the window (median) | Signings / season | Spent / season | Sales / season | Squad range | Balance start → end (median) | Balance change: you vs AI clubs (median) | Seasons ending in debt | Position start → end (avg) | Sacked | Seasons out of work |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tier 2 | 8 | €12.5M | 0.9 | €7.9M | 0.0 | 25–30 | €12.5M → €12.5M | €6.0M vs €10.8M | 0% | 12.1 → 10.3 | 3 | 12 |
| tier 1 | 14 | €64.6M | 0.8 | €23.7M | 0.1 | 25–30 | €64.6M → €82.6M | €42.9M vs €37.8M | 0% | 11.0 → 12.9 | 3 | 6 |
| tier 3 | 10 | €3.4M | 0.3 | €610K | 0.2 | 25–30 | €3.4M → €6.4M | €2.5M vs €955K | 0% | 13.8 → 10.1 | 3 | 10 |

Squad average age: 25.1 at the start, 23.5 at the end.

Failed bids: His €X/wk would break the board's wage cap of €X/wk (137); <name> doesn't want to join (58); The squad is full: sell someone first (52); <name> can't spare him (12); <name>ć doesn't want to join (6); Óscar Martín doesn't want to join (2).

Failed sales: No club is in for him right now: list him and wait (313); <name> won't go to any of the 2 clubs in for him (119); <name> won't go to <name> (94); <name> won't go to any of the 3 clubs in for him (45); <name> won't go to any of the 4 clubs in for him (32); <name> won't go to Wrexham (13).

## Manager board

| Tier | Seasons | League target met | Cup target met | Youth debuts met | Wage cap met | Ultimatums | Sacked in season | Sacked at the review | Seasons with no signing | Bids blocked by the cap | Wage bill / cap at the window (median) | Prospects promoted / season |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tier 2 | 8 | 100% | 20% | 60% | 100% | 13% | 2 | 1 | 25% | 32% | 90% | 1.1 |
| tier 1 | 14 | 90% | 30% | 50% | 100% | 21% | 0 | 3 | 50% | 40% | 83% | 0.9 |
| tier 3 | 10 | 83% | 33% | 33% | 100% | 20% | 2 | 1 | 80% | 52% | 90% | 0.8 |

AI managers (English pyramid around the user's club): 14.1% of clubs change manager during a season and 5.0% over the summer (60 seasons).

## Injury and recovery choices

Each career follows one policy for every moderate-or-worse injury (serious ones: rush → conservative, plan and rest → surgery, clinic → clinic when affordable). Youth careers are left out.

| Policy | Careers | Seasons | Big injuries / season | Weeks out per big injury | Injured again within 10 weeks of the return | Weeks injured / season | Same-area re-injuries per big injury | Apps / season | Overall change over the run | Career threats | Retired through injury |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rush | 40 | 200 | 0.17 | 2.2 (32) | 31% | 1.5 | 0.06 | 31.8 | 8.1 | 0 | 0 |
| plan | 40 | 200 | 0.12 | 4.7 (19) | 26% | 1.6 | 0.00 | 30.3 | 7.2 | 0 | 0 |
| rest | 40 | 200 | 0.13 | 6.2 (24) | 21% | 1.9 | 0.00 | 30.5 | 7.3 | 0 | 0 |
| clinic | 40 | 200 | 0.18 | 2.5 (36) | 14% | 1.5 | 0.00 | 30.8 | 7.0 | 0 | 0 |

## Off-pitch drama

550 stories in 800 senior player-seasons: 0.69 a season; 54% of seasons have at least one. Choices are random.

| Cohort | Seasons | Stories / season | Stand-off | Cliques | Fall-out | Captaincy |
| --- | --- | --- | --- | --- | --- | --- |
| academy | 160 | 0.57 | 0 | 43 | 49 | 0 |
| late-starter | 160 | 0.71 | 0 | 54 | 53 | 7 |
| established | 160 | 0.72 | 7 | 53 | 48 | 7 |
| star | 160 | 0.54 | 2 | 65 | 14 | 5 |
| late-abroad | 160 | 0.55 | 1 | 44 | 38 | 5 |

| Story | First choice | Outcomes |
| --- | --- | --- |
| captaincy | back-rival | backed the rival (7) |
| captaincy | campaign | won the armband (4), lost to the rival (1) |
| captaincy | football | lost to the rival (10), won the armband (2) |
| clique | bridge | the split deepened (58), united the squad (37) |
| clique | side-a | sided with the young guns (90) |
| clique | side-b | sided with the senior pros (97) |
| fallout | apologise | apologised (73) |
| fallout | board | the board backed you (63), the board backed the manager (17) |
| fallout | firm | handed in a transfer request (45), kept your head down (33), moved on (3) |
| standoff | quiet | talks opened quietly (7) |
| standoff | sign | asked for the best offer (3) |

## Transfer drama

| Cohort | Seasons | Bidding wars / season | Deadline-day bids / season | Leaks (asks careers) | Leak → improved contract |
| --- | --- | --- | --- | --- | --- |
| academy | 160 | 0.16 | 0.00 | 91 | 29% |
| late-starter | 160 | 0.36 | 0.00 | 76 | 79% |
| established | 160 | 0.76 | 0.57 | 119 | 64% |
| star | 160 | 0.20 | 0.81 | 92 | 83% |
| youth | 160 | 0.03 | 0.00 | 31 | 6% |
| late-abroad | 160 | 0.25 | 0.00 | 64 | 41% |

## Youth start (age 15)

32 careers; half go on every trial they are offered and take a trial club over the academy when they can.

| Trials | Careers | Invitations | Went | Impressed | Offers at 17 | Signed with | A season later | Overall at 17 | Senior minutes at 17 | Senior minutes at 18 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| went | 15 | 3.0 | 3.0 | 1.4 | home + trial club + trial club + free 3, free 3, home + free 3, home + trial club + trial club + trial club + free 4, home + trial club + free 2 | trial club 9, free agent 3, academy 3 | other club 10, academy 5 | 57.5 | 0 | 362 |
| stayed / none | 17 | 2.3 | 0.0 | 0.0 | free 4, home + free 13 | free agent 4, academy 13 | no club 4, other club 5, academy 8 | 57.5 | 0 | 760 |

## Late starters: first-team football

| Start club | Careers | Apps season 1 (median) | Minutes season 1 (median) | No apps in season 1 | Apps season 2 (median) | Weeks to the first appearance (median) |
| --- | --- | --- | --- | --- | --- | --- |
| arg-boca-juniors | 3 | 0 | 0 | 100% | 22 | 53 |
| arg-colon | 2 | 34 | 2314 | 0% | 37 | 5 |
| bra-flamengo | 3 | 11 | 203 | 33% | 20 | 29 |
| bra-goias | 3 | 17 | 755 | 0% | 30 | 10 |
| eng-millwall | 8 | 15 | 414 | 0% | 41 | 26 |
| eng-reading | 8 | 35 | 1197 | 0% | 42 | 5 |
| eng-stockport-county | 8 | 34 | 1033 | 0% | 43 | 3 |
| eng-wycombe | 8 | 28 | 1118 | 0% | 29 | 5 |
| mex-monterrey | 3 | 0 | 0 | 100% | 14 | 55 |
| mex-tigres-uanl | 2 | 0 | 0 | 100% | 15 | 131 |
| ned-az-alkmaar | 3 | 0 | 0 | 100% | 27 | 53 |
| ned-nac-breda | 2 | 12 | 899 | 0% | 23 | 29 |
| por-braga | 3 | 12 | 466 | 0% | 35 | 28 |
| por-chaves | 3 | 1 | 95 | 0% | 14 | 30 |
| usa-louisville-city | 2 | 38 | 1285 | 0% | 39 | 5 |
| usa-seattle-sounders | 3 | 14 | 829 | 0% | 35 | 28 |
