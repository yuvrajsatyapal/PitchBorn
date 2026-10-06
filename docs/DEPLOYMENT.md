# Deployment

`npm run build` produces a static site in `out/` (HTML per route, hashed assets, `manifest.webmanifest`, generated `sw.js`). Host it anywhere static for free: Cloudflare Pages, GitHub Pages, Netlify, Vercel (static), any S3/CDN.

- Build command `npm run build`, output directory `out`.
- `trailingSlash: true` — routes are `/play/`, `/play/league/` etc. (works without rewrites).
- Serve `sw.js` with `Cache-Control: no-cache` so updates roll out; hashed `/_next/static` assets can be cached immutably.
- Optional ad env vars: see ADVERTISING.md (never commit IDs).
- Data refresh: `npm run data:fetch && npm run data:build`, commit `data/raw` + `src/data/world.json`, rebuild.
