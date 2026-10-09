# Data sources & licences

| Source | Licence | Used for |
|---|---|---|
| [Wikidata](https://www.wikidata.org/) | CC0 1.0 | League membership, stadiums & capacities, founding years, colours, cities, coordinates, current head coaches (P286) of clubs and national teams |
| [OpenFootball clubs](https://github.com/openfootball/clubs) | CC0 1.0 | Canonical names and aliases for cross-source matching |
| [OpenFootball football.json](https://github.com/openfootball/football.json) | CC0 1.0 | Real results 2020-21 → 2024-25 → historical tables and prestige |
| [flag-icons](https://github.com/lipis/flag-icons) | MIT | Country flags |
| Lilita One, Outfit, Chakra Petch (Google Fonts) | SIL OFL 1.1 | Typography (self-hosted at build) |

Provenance per club is stored in `world.json` (`sources`). The visual asset registry is `src/data/assets.json` (rendered on /credits).

**Not used**: EA Sports FC/FIFA, Football Manager, eFootball, SoFIFA, Opta or any proprietary ratings, potentials, hidden attributes, market values, development curves or balancing. All gameplay numbers are Pitchborn's own.

**Not bundled**: official crests, competition logos, kits, player/stadium photos (trademark/rights). Generated Pitchborn emblems and kits are used instead; the art components are the single place to plug licensed assets in later.
