import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createRouter } from './api.js';
import { createJob, updateJob } from '../services/jobStore.js';

vi.mock('../services/scraper.js', () => ({
  scrapeUrl: vi.fn().mockResolvedValue(undefined),
}));

const mockStorage = {
  upload: vi.fn(),
  getImageUrl: vi.fn().mockReturnValue('/api/images/job/file.jpg'),
  listImages: vi.fn().mockResolvedValue([]),
  deleteJob: vi.fn(),
  getFilePath: vi.fn().mockRejectedValue(new Error('not found')),
};

const app = express();
app.use(express.json());
app.use('/api', createRouter(mockStorage));

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getImageUrl.mockReturnValue('/api/images/job/file.jpg');
  mockStorage.listImages.mockResolvedValue([]);
  mockStorage.getFilePath.mockRejectedValue(new Error('not found'));
});

describe('POST /api/scrape', () => {
  it('returns 400 when url is missing', async () => {
    const res = await request(app).post('/api/scrape').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('url is required');
  });

  it('returns 400 for an invalid URL string', async () => {
    const res = await request(app).post('/api/scrape').send({ url: 'not-a-url' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid URL');
  });

  it('returns 400 for non-http/https protocol', async () => {
    const res = await request(app).post('/api/scrape').send({ url: 'ftp://example.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Only http/);
  });

  it('returns 200 with jobId for a valid URL', async () => {
    const res = await request(app).post('/api/scrape').send({ url: 'https://example.com' });
    expect(res.status).toBe(200);
    expect(res.body.jobId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('GET /api/jobs/:jobId', () => {
  it('returns 404 for an unknown jobId', async () => {
    const res = await request(app).get('/api/jobs/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Job not found');
  });

  it('returns the job for a known id', async () => {
    const job = createJob();
    const res = await request(app).get(`/api/jobs/${job.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(job.id);
    expect(res.body.status).toBe('pending');
  });

  it('reflects job state updates', async () => {
    const job = createJob();
    updateJob(job.id, { status: 'done', foundCount: 3 });
    const res = await request(app).get(`/api/jobs/${job.id}`);
    expect(res.body.status).toBe('done');
    expect(res.body.foundCount).toBe(3);
  });
});

describe('GET /api/images/:jobId/:filename', () => {
  it('returns 400 for a path traversal attempt via encoded slash', async () => {
    // Express decodes %2F in params; path.basename catches the directory component
    const res = await request(app).get('/api/images/job1/sub%2Fimage.jpg');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid filename');
  });

  it('returns 404 when image not found in storage', async () => {
    mockStorage.getFilePath.mockRejectedValueOnce(new Error('ENOENT'));
    const res = await request(app).get('/api/images/job1/image.jpg');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Image not found');
  });
});

describe('GET /api/jobs/:jobId/zip', () => {
  it('returns 404 for an unknown jobId', async () => {
    const res = await request(app).get('/api/jobs/nonexistent/zip');
    expect(res.status).toBe(404);
  });

  it('returns 400 when job is not yet done', async () => {
    const job = createJob(); // status: pending
    const res = await request(app).get(`/api/jobs/${job.id}/zip`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not complete/);
  });

  it('returns 404 when job is done but has no images', async () => {
    const job = createJob();
    updateJob(job.id, { status: 'done' });
    mockStorage.listImages.mockResolvedValueOnce([]);
    const res = await request(app).get(`/api/jobs/${job.id}/zip`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('No images found');
  });
});
