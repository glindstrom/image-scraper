import { randomUUID } from 'crypto';

const jobs = new Map();

export function createJob() {
  const id = randomUUID();
  const job = {
    id,
    status: 'pending',
    foundCount: 0,
    images: [],
    error: null,
    createdAt: new Date().toISOString(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id) {
  return jobs.get(id) ?? null;
}

export function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch);
  return job;
}
