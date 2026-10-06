# Data & privacy considerations

- No accounts, no backend, no analytics. Careers live in the user's IndexedDB; exports are user-initiated files.
- localStorage holds only theme and advertising-consent preferences.
- No third-party requests in the default build (fonts are self-hosted by `next/font`; flags are bundled).
- Advertising is off by default in production. When enabled, personalised ads require an explicit choice, the game works if declined/blocked, and a certified CMP is required where the law demands (see ADVERTISING.md).
- The service worker never intercepts cross-origin (ad) requests.
- Players are fictional; real clubs are referenced factually without endorsement.
