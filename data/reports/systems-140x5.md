# Systems simulation: 128 player careers and 12 manager careers × 5 seasons

640 player-seasons and 34 manager-seasons (1580s). Autopilot plays; see the header of scripts/sim/systems.mts for the policies.

## Lifestyle: what a home costs

| Cohort | Careers | Wage at start (median) | Price level at start | City flat in weeks of wages | Sensible: first home after (weeks) |
| --- | --- | --- | --- | --- | --- |
| academy | 32 | €2K | 0.21 | 7.1 | 112 (16/16 bought one) |
| late-starter | 32 | €3K | 0.26 | 5.8 | 64 (16/16 bought one) |
| established | 32 | €18K | 0.67 | 2.2 | 8 (16/16 bought one) |
| star | 32 | €49K | 1.00 | 1.2 | 4 (16/16 bought one) |

## Lifestyle: does money run out?

| Policy | Cohort | Seasons | Upkeep / wage (median) | Seasons with a forced sale | Bank at the end (median) | Net worth at the end (median) | Training injuries / season | Avg fitness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| frugal | academy | 40 | 0% | 0% | €1.0M | €1.0M | 0.55 | 87.2 |
| frugal | late-starter | 40 | 0% | 0% | €2.4M | €2.4M | 0.53 | 87.9 |
| frugal | established | 40 | 0% | 0% | €7.8M | €7.8M | 0.13 | 98.1 |
| frugal | star | 40 | 0% | 0% | €28.7M | €28.7M | 0.65 | 92.3 |
| sensible | academy | 40 | 16% | 0% | €714K | €727K | 0.88 | 87.9 |
| sensible | late-starter | 40 | 15% | 0% | €2.8M | €2.9M | 0.88 | 84.9 |
| sensible | established | 40 | 16% | 0% | €7.6M | €8.1M | 0.35 | 98.1 |
| sensible | star | 40 | 16% | 0% | €19.2M | €21.8M | 0.60 | 95.7 |
| lavish | academy | 40 | 79% | 5% | €71K | €129K | 0.82 | 88.5 |
| lavish | late-starter | 40 | 22% | 0% | €158K | €261K | 0.75 | 86.1 |
| lavish | established | 40 | 35% | 0% | €219K | €457K | 0.13 | 98.4 |
| lavish | star | 40 | 13% | 0% | €2.3M | €2.7M | 0.45 | 97.1 |
| investor | academy | 40 | 15% | 0% | €574K | €1.1M | 0.78 | 87.2 |
| investor | late-starter | 40 | 16% | 0% | €2.9M | €4.7M | 0.93 | 83.8 |
| investor | established | 40 | 17% | 0% | €3.8M | €6.8M | 0.47 | 96.2 |
| investor | star | 40 | 16% | 0% | €14.8M | €24.3M | 0.63 | 96.2 |

## Investments

| Kind | Yearly settlements | Mean return | Worst | Best | Years that lost money |
| --- | --- | --- | --- | --- | --- |
| bonds | 320 | 3.0% | 2% | 4% | 0% |
| property | 320 | 5.2% | -20% | 27% | 24% |
| startup | 52 | (settles once) | 17 went under | 35 paid off | 33% |

## Set pieces

Seasons for outfield players; "asks" careers ask the manager for both duties whenever they may.

| Position | Asks | Seasons | Took ≥1 penalty | Penalties / season | Scored | Held the penalty duty | Lost it | Free kicks / season | FK scored | Held the FK duty | Asked → granted |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ST | yes | 40 | 28% | 1.30 | 87% | 28% | 0% | 3.65 | 6% | 8% | 5/72 |
| ST | no | 40 | 18% | 0.47 | 84% | 0% | 0% | 0.00 | – | 0% | – |
| LW | yes | 40 | 23% | 0.63 | 76% | 10% | 5% | 5.75 | 10% | 13% | 4/70 |
| LW | no | 40 | 20% | 0.30 | 92% | 0% | 0% | 0.15 | 17% | 0% | – |
| AM | yes | 40 | 15% | 0.42 | 76% | 13% | 5% | 5.97 | 6% | 18% | 5/73 |
| AM | no | 40 | 10% | 0.33 | 85% | 0% | 0% | 6.78 | 7% | 0% | – |
| CM | yes | 40 | 10% | 0.35 | 79% | 10% | 3% | 10.68 | 8% | 18% | 6/73 |
| CM | no | 40 | 0% | 0.00 | – | 0% | 0% | 10.85 | 5% | 0% | – |
| DM | yes | 40 | 13% | 0.68 | 89% | 13% | 0% | 0.00 | – | 0% | 2/77 |
| DM | no | 40 | 8% | 0.15 | 67% | 0% | 0% | 1.18 | 4% | 0% | – |
| CB | yes | 40 | 0% | 0.00 | – | 0% | 0% | 0.00 | – | 0% | 0/80 |
| CB | no | 40 | 0% | 0.00 | – | 0% | 0% | 0.00 | – | 0% | – |
| RB | yes | 40 | 0% | 0.00 | – | 0% | 0% | 0.25 | 20% | 0% | 0/80 |
| RB | no | 40 | 0% | 0.00 | – | 0% | 0% | 0.15 | 33% | 0% | – |

| Cohort | Seasons (outfield) | Took ≥1 penalty | Never a penalty in the whole career | Penalties / season |
| --- | --- | --- | --- | --- |
| academy | 140 | 3% | 89% | 0.07 |
| late-starter | 140 | 16% | 68% | 0.48 |
| established | 140 | 0% | 100% | 0.00 |
| star | 140 | 21% | 61% | 0.77 |

## Manager transfer market

| Tier | Seasons | Budget at the window (median) | Signings / season | Spent / season | Sales / season | Squad range | Balance start → end (median) | Balance change: you vs AI clubs (median) | Seasons ending in debt | Position start → end (avg) | Sacked | Seasons out of work |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tier 2 | 11 | €8.3M | 0.9 | €7.2M | 0.2 | 22–26 | €8.3M → €8.3M | €7.6M vs €8.0M | 18% | 13.1 → 9.5 | 2 | 9 |
| tier 1 | 16 | €45.6M | 1.7 | €38.5M | 0.3 | 22–30 | €45.6M → €42.8M | -€1.9M vs €30.7M | 6% | 10.2 → 10.6 | 1 | 4 |
| tier 3 | 7 | €2.4M | 1.0 | €1.6M | 0.0 | 25–29 | €2.4M → €998K | €63K vs €1.2M | 29% | 11.3 → 11.1 | 3 | 13 |

Squad average age: 25.1 at the start, 24.4 at the end.

Failed bids: <name> doesn't want to join (83); <name>ć doesn't want to join (14); <name> can't spare him (13); The squad is full: sell someone first (11); <name>é doesn't want to join (8); Leon Möller doesn't want to join (5).

Failed sales: <name> won't go to <name> (223); No club is in for him right now: list him and wait (194); <name> won't go to Blackpool (15); <name>ć won't go to AFC Bournemouth (14); Jurriën de won't go to <name> (13); <name>ć won't go to Brentford (13).
