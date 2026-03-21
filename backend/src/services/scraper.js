import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import path from 'path';
import mime from 'mime-types';
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

function extractSrcset(srcset) {
  return srcset.split(',').map(part => part.trim().split(/\s+/)[0]).filter(Boolean);
}

function deriveFilename(imageUrl, contentType) {
  try {
    const urlPath = new URL(imageUrl).pathname;
    const base = path.basename(urlPath);
    if (base && base.includes('.')) return base;
  } catch {}
  // Fallback: hash of URL + extension from content-type
  const ext = mime.extension(contentType) || 'jpg';
  const hash = Buffer.from(imageUrl).toString('base64url').slice(0, 16);
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

  $('img[src]').each((_, el) => rawUrls.push($(el).attr('src')));
  $('img[srcset]').each((_, el) => rawUrls.push(...extractSrcset($(el).attr('srcset'))));
  $('source[srcset]').each((_, el) => rawUrls.push(...extractSrcset($(el).attr('srcset'))));
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
