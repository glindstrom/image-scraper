import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { StorageProvider } from './StorageProvider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JOBS_DIR = path.resolve(__dirname, '../../storage/jobs');

export class LocalStorageProvider extends StorageProvider {
  async #jobDir(jobId) {
    const dir = path.join(JOBS_DIR, jobId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async #readMeta(jobId) {
    const dir = path.join(JOBS_DIR, jobId);
    const metaPath = path.join(dir, '_meta.json');
    try {
      const raw = await fs.readFile(metaPath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return { images: [] };
    }
  }

  async #writeMeta(jobId, meta) {
    const dir = path.join(JOBS_DIR, jobId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, '_meta.json'), JSON.stringify(meta, null, 2));
  }

  async upload(jobId, filename, buffer, contentType) {
    const dir = await this.#jobDir(jobId);
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, buffer);

    const meta = await this.#readMeta(jobId);
    const existing = meta.images.findIndex(i => i.filename === filename);
    const entry = { filename, contentType, size: buffer.length };
    if (existing >= 0) meta.images[existing] = entry;
    else meta.images.push(entry);
    await this.#writeMeta(jobId, meta);

    return `${jobId}/${filename}`;
  }

  getImageUrl(jobId, filename) {
    return `/api/images/${jobId}/${encodeURIComponent(filename)}`;
  }

  async listImages(jobId) {
    const meta = await this.#readMeta(jobId);
    return meta.images.map(img => ({
      ...img,
      url: this.getImageUrl(jobId, img.filename),
    }));
  }

  async deleteJob(jobId) {
    const dir = path.join(JOBS_DIR, jobId);
    await fs.rm(dir, { recursive: true, force: true });
  }

  /** Returns full filesystem path for a stored image (used by route to stream file). */
  async getFilePath(jobId, filename) {
    return path.join(JOBS_DIR, jobId, filename);
  }
}
