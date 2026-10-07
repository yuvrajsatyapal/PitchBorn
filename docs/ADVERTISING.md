# Ads & sponsors architecture

Ads are infrastructure, not gameplay. The engine never imports `src/ads`. The game is fully playable with ads disabled, blocked, failing, slow or offline.

## Components
- `config.ts` — **central placement & frequency config**: placement ids, allowed pages, device (desktop/mobile/all), format (rail/inline/banner), reserved min height, priority; rules: `maxSlotsPerPage` (3), `neverOn` pages (new career, career/contract negotiation, training, settings, legacy), blocked game states, rail minimum viewport (1440 px), rewarded toggle.
- `providers.ts` — `AdProvider` interface (`init`, `render`, `destroy`, `supportsRewarded`, `showRewarded`). Implementations: `none`, `placeholder` (labelled dev/test boxes), `adsense` (loads only with credentials **and** a consent choice; non-personalised via `data-npa` unless consent granted).
- `AdContext.tsx` — provider root, readiness, consent subscription, `useSuppressAds()` (live match screen suppresses all ads).
- `AdSlot.tsx` — `AdSlot`, `InlineAdSlot`, `ResponsiveAdSlot`, `SidebarAdSlot`, `MobileAdSlot`. Reserve space up front (no layout shift), "Ad / Sponsor" label, collapse gracefully on failure/timeout (8 s) or when unfilled.
- `ConsentBanner.tsx` / `consent.ts` — consent **integration point** (shown only when a real provider is configured). It is not a certified CMP.
- `RewardedButton.tsx` — optional rewarded ads; hidden unless the provider can verify completion; rewards are granted only on `completed && verified`.

## Placements
Desktop: right rail on dashboard/statistics/league/history/world/club/awards (≥1440 px), between dashboard sections, below league tables, after match results, between history groups, at feed boundaries, footer of public pages. Mobile: inline between sections and after results; never a rail. Never inside navigation, over match events, inside forms/negotiations/decisions, or styled like game buttons.

## Rewarded (optional)
Centralised in `BALANCE.rewards`: +12% training effectiveness for 2 weeks (6-week cooldown), +12 fitness recovery (4-week cooldown), small temporary morale boost. No permanent attribute boosts. Never required to progress.

## Before enabling production ads
1. Set `NEXT_PUBLIC_AD_PROVIDER=adsense`, `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-…`, `NEXT_PUBLIC_ADSENSE_SLOTS={"rail-right":"…","dashboard-break":"…",…}` in the hosting environment — **never commit them**.
2. Configure a Google-certified CMP (IAB TCF v2.2) for EEA/UK/Switzerland and wire it into `consent.ts` (replace the integration-point banner).
3. Add `ads.txt` to `public/` with the publisher line.
4. Update the privacy notice with the provider's details.
5. Rewarded web ads need a provider SDK with server-verified completion callbacks before `supportsRewarded()` returns true.

Default production build: provider `none` (nothing loads). Development: `placeholder`.
