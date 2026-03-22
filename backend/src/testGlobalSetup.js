import { rm } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const JOBS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../storage/jobs');

async function wipeJobsDir() {
  await rm(JOBS_DIR, { recursive: true, force: true });
}

export const setup = wipeJobsDir;
export const teardown = wipeJobsDir;
