# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start both server (port 3001) and client (port 5173)
```

No test runner or linter is configured.

To run just one workspace:
```bash
npm run dev --workspace=backend
npm run dev --workspace=frontend
```

## Architecture

npm workspaces monorepo. The server is ESM (`"type":"module"`) and uses `node --watch` in dev. The client is React 18 + Vite; all `/api` requests are proxied to `http://localhost:3001` by Vite.

### Request flow

1. Client POSTs `{ url }` to `/api/scrape` → server creates a job in the in-memory `jobStore` (a plain `Map`) and immediately returns `{ jobId }`.
2. `scrapeUrl` runs fire-and-forget: fetches the page with axios, parses `<img src>`, `<img srcset>`, `<source srcset>`, and `og:image` meta tags via Cheerio, then downloads images in batches of 5 (`Promise.allSettled` — individual failures don't abort the batch).
3. Client polls `GET /api/jobs/:jobId` every 1500 ms (`useJobPoller`) until status is `done` or `error`.
4. Images are served back through Express at `/api/images/:jobId/:filename` regardless of storage provider (client is provider-agnostic).

### Storage provider pattern

`StorageProvider` (abstract base in `server/src/storage/StorageProvider.js`) defines the interface: `upload`, `getImageUrl`, `listImages`, `deleteJob`. Selected at startup via `STORAGE_PROVIDER` env var (`local` default, `s3` for `S3StorageProvider`). The router duck-types on `storage.getFilePath` vs `storage.getObjectStream` to serve images for local vs S3.

### Job lifecycle

Jobs live only in memory (`jobStore.js`); they are lost on server restart. States: `pending` → `processing` → `done` | `error`. `foundCount` is set immediately after HTML parse so the UI can show progress before downloads finish.

### Key constraints

- Images capped at 20 MB each; 15 s timeout per request.
- Path traversal guard on the image route: `path.basename(filename)` must equal the raw filename param.
- CORS is locked to `http://localhost:5173`.
