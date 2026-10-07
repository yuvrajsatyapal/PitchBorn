# Player traits

Attributes say **how good** a player is. Traits say **how the player tends to play**.

## Where things live
`src/engine/traits/`
- `registry.ts` – the single data table of ~100 traits (id, name, blurb, category, positions, requirements, conflicts, evidence signals, effects, rarity, evolution). Add a trait = add a `def(...)`.
- `types.ts` – `TraitDef`, `MatchFx` (match behaviour/effectiveness modifiers), `CareerFx` (personality effects).
- `effects.ts` – stage strength, core-fit scaling, `resolveMatchFx`, `careerProfile`.
- `rules.ts` – eligibility, conflicts (exclusive / unlikely), limits, candidate weighting.
- `assign.ts` – creation-time traits (NPC), derived personality/flaws, deterministic trait RNG per player.
- `develop.ts` – evidence from matches, gated training contribution, annual review (weakening, evolution, NPC proxy growth).
- `career.ts` – loyalty/ambition in transfers and contracts, loyalty stands, weekly personality, settling abroad.
- `identity.ts` – grouped display and the "play identity" label used in profile and retirement.

## Principles
- **Style traits change behaviour** (which action is chosen: more long shots, crosses, tackles, headers) and nudge effectiveness a little; quality still comes from attributes. Effects scale by stage (Emerging 0.5 / Established 0.85 / Signature 1.15) and, for effectiveness, by how well the attributes back the trait (`coreFit`).
- **Acquired, never clicked.** The user starts without playing style. Evidence from matches (shots by type, chances created, interceptions…), plus capped training, fills a per-trait progress counter; crossing 30 xp earns Emerging, 80 Established, 160 Signature (rare, at most 2).
- **Loss and evolution.** Requirements failing, age, disuse and replacement weaken traits; e.g. Speed Runner can evolve into Inside Threat / Inverted Creator.
- **Limits.** Style 1–5 by overall, mind/body 3, personality 4, flaws 2, signature 0–2.
- **NPCs** get traits on creation; everyone gets a cheap annual review; only the user and players in the user's matches collect per-match evidence.
- **Determinism.** Trait draws use an RNG seeded from player identity and season, never the world stream.
- **Persistence.** Stored as `"id:xp:since;…"` per player; schema v5 migration seeds traits for old saves.
- **Memory.** Only identity-defining developments (a Signature trait, an evolution, a loyalty stand) create memories.
