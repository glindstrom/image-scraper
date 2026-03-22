# Image Scraper

A web application that accepts a URL, downloads all images found on the page, and presents them for viewing and bulk download.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Running with Docker](#running-with-docker)
- [Running without Docker](#running-without-docker)
- [Running Tests](#running-tests)
- [Architecture](#architecture)
- [Limitations](#limitations)
- [Further Development](#further-development)

---

## Prerequisites

### Without Docker

- Node.js 20 or later
- npm 9 or later

### With Docker

- Docker 24 or later
- Docker Compose v2 (included with Docker Desktop)

---

## Running with Docker

```bash
docker compose up
```

The first run will build the images, which takes a minute. Once running:

> **After making code changes**, rebuild before starting:
> ```bash
> docker compose up --build
> ```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001

Scraped images are stored in a named Docker volume (`backend-storage`) and persist across container restarts.

To stop and remove containers:

```bash
docker compose down
```

To also remove the stored image data:

```bash
docker compose down -v
```

---

## Running without Docker

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment:**

   Copy `.env.example` to `.env` in the project root. The defaults work out of the box for local development:

   ```bash
   cp .env.example .env
   ```

3. **Start both services:**

   ```bash
   npm run dev
   ```

   This starts the backend (port 3001) and the Vite dev server (port 5173) concurrently.

   To start each service individually:

   ```bash
   npm run dev --workspace=backend
   npm run dev --workspace=frontend
   ```

4. Open http://localhost:5173 in your browser.

---

## Running Tests

### Backend unit and integration tests

```bash
npm run test --workspace=backend
```

This runs all Vitest tests under `backend/src/`, including:

- Unit tests for `jobStore`, `scraper`, and `LocalStorageProvider`
- HTTP integration tests for the API routes (via Supertest)
- A live integration test that scrapes iltalehti.fi

The test runner cleans `backend/storage/jobs/` before and after the suite via Vitest's `globalSetup`.

> **Note:** The live integration test requires network access and may be slow (~60 s timeout).

### End-to-end tests

The E2E tests use Playwright and require the full application to be running (Playwright starts it automatically):

```bash
npm run test:e2e
```

This runs browser tests against:

- iltalehti.fi — expects at least one image to be found
- example.com — expects zero images
- Wikipedia Contract Bridge — expects images to be found
- google.com/404 — expects an error state

Playwright's `globalTeardown` cleans `backend/storage/jobs/` after the suite completes.

### Run everything

```bash
npm test
```

---

## Architecture

The application is a monorepo of two npm workspaces:

```
image-scraper/
├── backend/        # Express API (Node.js, ESM)
├── frontend/       # React 18 + Vite
└── docker-compose.yml
```

### Request flow

```
Browser
  │
  │  POST /api/scrape { url }
  ▼
Frontend (Vite dev server / nginx)
  │  proxy /api → backend
  ▼
Backend: creates job, returns { jobId }  ──►  scrapeUrl() runs fire-and-forget
  │
  │  GET /api/jobs/:jobId  (every 1500 ms)
  ▼
Frontend polls until status = done | error
```

### Scraping pipeline

1. Fetch the target page HTML with Axios (15 s timeout, custom `User-Agent`).
2. Parse image URLs from the static HTML using Cheerio:
   - `<img srcset>` — only the highest-`w` or highest-`x` descriptor is kept; `src` is skipped when `srcset` is present (it is the low-quality fallback)
   - `<img src>` — used when no `srcset` is present
   - Lazy-loading data attributes: `data-srcset` / `data-lazy-srcset` (best descriptor only), then `data-src`, `data-lazy-src`, `data-original`
   - `<source srcset>` and `<source data-srcset>` (for `<picture>` elements, best descriptor only)
   - `<meta property="og:image">` (Open Graph)
3. Resolve all URLs relative to the page's base URL and deduplicate.
4. Download images in batches of 5 using `Promise.allSettled` — individual failures do not abort the batch. Each image is capped at 20 MB.
5. Persist images via the configured storage provider.

### Job lifecycle

Jobs are stored in an in-memory `Map` and are lost on server restart. States:

```
pending → processing → done
                     → error
```

`foundCount` is set immediately after HTML parsing so the UI can show progress before downloads complete.

### Storage provider pattern

`StorageProvider` is an abstract base class with the interface `upload`, `getImageUrl`, `listImages`, `deleteJob`, `cleanup`. The active provider is selected by the `STORAGE_PROVIDER` environment variable:

| Value   | Class                    | Description                         |
|---------|--------------------------|-------------------------------------|
| `local` | `LocalStorageProvider`   | Writes files to `backend/storage/jobs/<jobId>/` with a `_meta.json` sidecar |
| `s3`    | `S3StorageProvider`      | Stub — structure is in place but not fully implemented |

Images are always served back through the Express API at `/api/images/:jobId/:filename`, keeping the frontend storage-agnostic.

### Security

- Path traversal guard on the image route: `path.basename(filename)` must equal the raw filename param.
- Only `http:` and `https:` protocols are accepted as scrape targets.
- CORS is locked to `FRONTEND_URL` (defaults to `http://localhost:5173`).

---

## Limitations

**No JavaScript rendering.** The scraper fetches raw HTML only. Pages that render images client-side (e.g. single-page applications) will return far fewer images than a browser would see. For example, iltalehti.fi — a client-side rendered SPA — yields only 6 images from its static HTML, while the fully rendered page contains hundreds.

**Jobs are not persisted.** The in-memory job store is lost on server restart. Any in-progress or completed jobs disappear if the backend process is restarted.

**No deduplication across jobs.** Two scrape requests for the same URL will download all images twice and store two separate copies.

**No authentication or rate limiting.** The API accepts requests from any client on `FRONTEND_URL`. There is no per-IP or per-user throttling.

**Sequential batch processing.** Batches of 5 are processed serially, not in parallel across batches. For a page with 100 images this means 20 sequential rounds of 5 concurrent downloads.

**Filenames can collide.** If two different images on a page share the same filename in their URL path, the second download overwrites the first.

**S3 storage is a stub.** The `S3StorageProvider` class exists and the provider selection is wired up, but the implementation is not complete.

**No image type filtering.** Any URL that responds with a `Content-Type: image/*` header is accepted, including tracking pixels and 1×1 spacer GIFs.

---

## Further Development

**Headless browser rendering.** Integrate Puppeteer or Playwright server-side to render JavaScript before scraping. This would capture images loaded by client-side frameworks and infinite-scroll pages.

**Persistent job store.** Replace the in-memory `Map` with a database (SQLite for a self-contained setup, PostgreSQL for production). This would survive restarts and allow job history.

**Result caching.** Cache scrape results by URL and a configurable TTL. Repeated requests for the same URL would return the cached job immediately instead of re-downloading all images.

**S3 storage implementation.** Complete the `S3StorageProvider` to store images in an S3-compatible bucket, enabling horizontal scaling and durable storage without a mounted volume.

**Queue-based scraping.** Replace the fire-and-forget approach with a proper job queue (BullMQ, pg-boss). This would support retries, concurrency limits, and visibility across multiple backend instances.

**Image deduplication.** Hash each image by content (MD5 or perceptual hash) and skip storing duplicates within or across jobs.

**Filtering and selection.** Let users filter results by minimum dimensions or file size, and select individual images before downloading rather than getting everything.

**Pagination and streaming.** Stream image results to the frontend as they complete rather than waiting for the entire job to finish, giving faster feedback on large pages.

**Authentication.** Add user accounts so that job history and stored images are scoped per user rather than being globally accessible.

**Rate limiting.** Add per-IP request limits to prevent the API from being abused as an open proxy for bulk downloading.
