# Data sources & licences

| Source | Licence | Used for |
|---|---|---|
| [Wikidata](https://www.wikidata.org/) | CC0 1.0 | League membership, stadiums & capacities, founding years, colours, cities, coordinates |
| [OpenFootball clubs](https://github.com/openfootball/clubs) | CC0 1.0 | Canonical names and aliases for cross-source matching |
| [OpenFootball football.json](https://github.com/openfootball/football.json) | CC0 1.0 | Real results 2020-21 → 2024-25 → historical tables and prestige |
| [Wikimedia Commons](https://commons.wikimedia.org/) (via Wikidata P154) | Per file: PD / CC0 / CC BY / CC BY-SA | Official club crests — only freely licensed files; per-file provenance in `src/data/crests.json`, shown on /credits |
| [flag-icons](https://github.com/lipis/flag-icons) | MIT | Country flags |
| Lilita One, Outfit, Silkscreen (Google Fonts) | SIL OFL 1.1 | Typography (self-hosted at build) |

Provenance per club is stored in `world.json` (`sources`). The visual asset registry is `src/data/assets.json` (rendered on /credits).

**Not used**: EA Sports FC/FIFA, Football Manager, eFootball, SoFIFA, Opta or any proprietary ratings, potentials, hidden attributes, market values, development curves or balancing. All gameplay numbers are Pitchborn's own.

**Club crests**: `npm run data:crests` bundles a club's official crest only when its Commons licence permits redistribution; others keep the generated emblem. A free copyright licence is not a trademark licence — crests are used solely to identify clubs, with no implied endorsement. Set `NEXT_PUBLIC_OFFICIAL_CRESTS=off` to ship generated emblems only.

**Not bundled**: competition logos, kits, player/stadium photos (trademark/rights). Generated Pitchborn emblems and kits are used instead; the art components are the single place to plug licensed assets in later.
