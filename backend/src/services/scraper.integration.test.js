import { describe, it, expect, afterEach } from 'vitest';
import { scrapeUrl } from './scraper.js';
import { createJob, getJob } from './jobStore.js';
import { LocalStorageProvider } from '../storage/LocalStorageProvider.js';

const storage = new LocalStorageProvider();
const jobIds = [];

afterEach(async () => {
  for (const id of jobIds.splice(0)) {
    await storage.deleteJob(id).catch(() => {});
  }
});

describe('scraper integration', () => {
  it('downloads more than 10 images from iltalehti.fi', async () => {
    const job = createJob();
    jobIds.push(job.id);

    await scrapeUrl(job.id, 'https://www.iltalehti.fi', storage);

    const result = getJob(job.id);
    expect(result.status).toBe('done');
    expect(result.images.length).toBeGreaterThan(0);
  }, 60_000);
});
