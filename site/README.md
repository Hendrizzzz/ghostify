# Ghostify Website

The public Ghostify landing page and verification-status views live here.

## Development

```sh
npm install
npm run dev
```

Create a production build with:

```sh
npm run build
```

The app handles `/`, `/status`, and `/status/history`. Vercel rewrites the two
status routes to the client entry point.

## Public status feed

`src/app/statusData.json` is the website source for `/status.json`.
`vite.config.ts` serves that file in development and copies it into `dist/`
during production builds. It is the single canonical status file committed to
the repository; the website and extension popup consume the deployed copy.

`.github/workflows/daily-verification.yml` proposes dated status changes in a
PR. It refreshes one pending daily proposal instead of creating duplicates. A
maintainer must complete the smoke checklist and merge before the public feed
changes. When the latest merged state is yellow, the scheduled job cannot
replace it with green. Manual dispatch supports `reported`, `in-progress`,
`known-issue`, and `verified` updates. Green proposals also require the recorded
Store version to match the verification build.

Vite copies the original Ghostify browser recordings from `public/` into the
production build. The landing page lazy-loads those GIFs as authentic feature
evidence rather than reconstructing the Meta interfaces. Keep the recordings
current and avoid replacing them with synthetic product mockups.
