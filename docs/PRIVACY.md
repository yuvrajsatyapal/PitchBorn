# Data & privacy considerations

- No accounts, no backend, no analytics. Careers live in the user's IndexedDB; exports are user-initiated files.
- localStorage holds only theme and advertising-consent preferences.
- No third-party requests in the default build (fonts are self-hosted by `next/font`; flags are bundled).
- The site shows no ads or sponsor spaces and loads no ad providers.
- The service worker never intercepts cross-origin (ad) requests.
- Players are fictional; real clubs are referenced factually without endorsement.
