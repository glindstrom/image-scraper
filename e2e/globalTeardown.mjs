import { rm } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const JOBS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../backend/storage/jobs'
);

export default async function globalTeardown() {
  await rm(JOBS_DIR, { recursive: true, force: true });
}
