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
during production builds. Keep `public/status.json` data-equivalent
because the extension package validator checks the public feed contract.

Vite copies the original Ghostify browser recordings from `public/` into the
production build. The landing page lazy-loads those GIFs as authentic feature
evidence rather than reconstructing the Meta interfaces. Keep the recordings
current and avoid replacing them with synthetic product mockups.
