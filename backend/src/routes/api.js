import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { createJob, getJob } from '../services/jobStore.js';
import { scrapeUrl } from '../services/scraper.js';

export function createRouter(storage) {
  const router = Router();

  // POST /api/scrape
  router.post('/scrape', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only http/https URLs are allowed' });
    }

    const job = createJob();
    // Fire and forget
    scrapeUrl(job.id, url, storage).catch(err => {
      console.error('Scrape error:', err);
    });

    res.json({ jobId: job.id });
  });

  // GET /api/jobs/:jobId
  router.get('/jobs/:jobId', (req, res) => {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  });

  // GET /api/images/:jobId/:filename
  router.get('/images/:jobId/:filename', async (req, res) => {
    const { jobId, filename } = req.params;
    // Guard against path traversal
    const safeName = path.basename(filename);
    if (safeName !== filename) return res.status(400).json({ error: 'Invalid filename' });

    if (storage.getFilePath) {
      // Local provider: stream from filesystem
      try {
        const filePath = await storage.getFilePath(jobId, safeName);
        res.sendFile(filePath);
      } catch {
        res.status(404).json({ error: 'Image not found' });
      }
    } else if (storage.getObjectStream) {
      // S3 provider: proxy stream from S3
      try {
        const { stream, contentType } = await storage.getObjectStream(jobId, safeName);
        res.setHeader('Content-Type', contentType);
        stream.pipe(res);
      } catch {
        res.status(404).json({ error: 'Image not found' });
      }
    } else {
      res.status(501).json({ error: 'Image serving not supported for this provider' });
    }
  });

  // GET /api/jobs/:jobId/zip
  router.get('/jobs/:jobId/zip', async (req, res) => {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'done') return res.status(400).json({ error: 'Job not complete' });

    const images = await storage.listImages(req.params.jobId);
    if (!images.length) return res.status(404).json({ error: 'No images found' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="images-${req.params.jobId}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', err => { throw err; });
    archive.pipe(res);

    for (const img of images) {
      if (storage.getFilePath) {
        const filePath = await storage.getFilePath(req.params.jobId, img.filename);
        archive.file(filePath, { name: img.filename });
      } else if (storage.getObjectStream) {
        const { stream } = await storage.getObjectStream(req.params.jobId, img.filename);
        archive.append(stream, { name: img.filename });
      }
    }

    archive.finalize();
  });

  return router;
}
