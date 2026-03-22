import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import path from 'path';
import mime from 'mime-types';
import { createHash } from 'crypto';
import { updateJob } from './jobStore.js';

const BATCH_SIZE = 5;
const TIMEOUT_MS = 15_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; ImageScraper/1.0)';

function resolveUrls(baseUrl, rawUrls) {
  const seen = new Set();
  const result = [];
  for (const raw of rawUrls) {
    if (!raw || raw.startsWith('data:')) continue;
    try {
      const resolved = new URL(raw, baseUrl).href;
      if (!seen.has(resolved)) {
        seen.add(resolved);
        result.push(resolved);
      }
    } catch {
      // skip malformed
    }
  }
  return result;
}

// Returns only the URL with the highest w/x descriptor from a srcset string.
// Falls back to all URLs when no descriptors are present.
function bestFromSrcset(srcset) {
  const entries = srcset.split(',').map(part => {
    const tokens = part.trim().split(/\s+/);
    const url = tokens[0];
    const descriptor = tokens[1] ?? '';
    const wMatch = descriptor.match(/^(\d+)w$/i);
    const xMatch = descriptor.match(/^([\d.]+)x$/i);
    return { url, w: wMatch ? parseInt(wMatch[1]) : null, x: xMatch ? parseFloat(xMatch[1]) : null };
  }).filter(e => e.url);

  if (entries.length === 0) return [];
  if (entries.some(e => e.w !== null))
    return [entries.reduce((a, b) => (b.w ?? 0) > (a.w ?? 0) ? b : a).url];
  if (entries.some(e => e.x !== null))
    return [entries.reduce((a, b) => (b.x ?? 0) > (a.x ?? 0) ? b : a).url];
  return entries.map(e => e.url);
}

function deriveFilename(imageUrl, contentType) {
  try {
    const urlPath = new URL(imageUrl).pathname;
    const base = path.basename(urlPath);
    if (base && base.includes('.')) return base;
  } catch {}
  // Fallback: hash of URL + extension from content-type
  const ext = mime.extension(contentType) || 'jpg';
  const hash = createHash('sha1').update(imageUrl).digest('hex').slice(0, 16);
  return `${hash}.${ext}`;
}

async function downloadImage(imageUrl) {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: TIMEOUT_MS,
    headers: { 'User-Agent': USER_AGENT },
    maxContentLength: 20 * 1024 * 1024, // 20MB limit
  });
  const contentType = response.headers['content-type']?.split(';')[0] ?? '';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Not an image: ${contentType}`);
  }
  return { buffer: Buffer.from(response.data), contentType };
}

async function processInBatches(items, batchSize, handler) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(handler));
    results.push(...settled);
  }
  return results;
}

export async function scrapeUrl(jobId, targetUrl, storage) {
  updateJob(jobId, { status: 'processing' });

  // 1. Fetch page HTML
  let html;
  try {
    const res = await axios.get(targetUrl, {
      timeout: TIMEOUT_MS,
      headers: { 'User-Agent': USER_AGENT },
    });
    html = res.data;
  } catch (err) {
    updateJob(jobId, { status: 'error', error: `Failed to fetch page: ${err.message}` });
    return;
  }

  // 2. Parse image URLs
  const $ = cheerio.load(html);
  const rawUrls = [];

  $('img').each((_, el) => {
    const $el = $(el);
    // Standard: srcset wins over src (src is the low-quality fallback when srcset is present)
    const srcset = $el.attr('srcset');
    if (srcset) {
      rawUrls.push(...bestFromSrcset(srcset));
    } else {
      const src = $el.attr('src');
      if (src) rawUrls.push(src);
    }
    // Lazy-loading: data-srcset wins over data-src variants
    const lazySrcset = $el.attr('data-srcset') || $el.attr('data-lazy-srcset');
    if (lazySrcset) {
      rawUrls.push(...bestFromSrcset(lazySrcset));
    } else {
      for (const attr of ['data-src', 'data-lazy-src', 'data-original']) {
        const val = $el.attr(attr);
        if (val) { rawUrls.push(val); break; }
      }
    }
  });
  $('source').each((_, el) => {
    const $el = $(el);
    const srcset = $el.attr('srcset') || $el.attr('data-srcset');
    if (srcset) rawUrls.push(...bestFromSrcset(srcset));
  });
  $('meta[property="og:image"]').each((_, el) => rawUrls.push($(el).attr('content')));

  const imageUrls = resolveUrls(targetUrl, rawUrls);
  updateJob(jobId, { foundCount: imageUrls.length });

  if (imageUrls.length === 0) {
    updateJob(jobId, { status: 'done' });
    return;
  }

  // 3. Download + upload in batches
  const successfulImages = [];

  await processInBatches(imageUrls, BATCH_SIZE, async (imageUrl) => {
    const { buffer, contentType } = await downloadImage(imageUrl);
    const filename = deriveFilename(imageUrl, contentType);
    await storage.upload(jobId, filename, buffer, contentType);
    const url = storage.getImageUrl(jobId, filename);
    successfulImages.push({ filename, contentType, size: buffer.length, url });
  });

  updateJob(jobId, {
    status: 'done',
    images: successfulImages,
  });
}
