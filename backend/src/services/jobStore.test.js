import { describe, it, expect } from 'vitest';
import { createJob, getJob, updateJob } from './jobStore.js';

describe('createJob', () => {
  it('returns a job with pending status and correct shape', () => {
    const job = createJob();
    expect(job.id).toBeDefined();
    expect(job.status).toBe('pending');
    expect(job.foundCount).toBe(0);
    expect(job.images).toEqual([]);
    expect(job.error).toBeNull();
    expect(job.createdAt).toBeDefined();
  });

  it('generates unique ids', () => {
    const a = createJob();
    const b = createJob();
    expect(a.id).not.toBe(b.id);
  });
});

describe('getJob', () => {
  it('returns the job after creation', () => {
    const job = createJob();
    expect(getJob(job.id)).toBe(job);
  });

  it('returns null for unknown id', () => {
    expect(getJob('nonexistent-id')).toBeNull();
  });
});

describe('updateJob', () => {
  it('patches the job in place', () => {
    const job = createJob();
    updateJob(job.id, { status: 'processing', foundCount: 5 });
    expect(job.status).toBe('processing');
    expect(job.foundCount).toBe(5);
  });

  it('returns the updated job', () => {
    const job = createJob();
    const result = updateJob(job.id, { status: 'done' });
    expect(result).toBe(job);
    expect(result.status).toBe('done');
  });

  it('returns null for unknown id', () => {
    expect(updateJob('nonexistent-id', { status: 'done' })).toBeNull();
  });

  it('does not overwrite unrelated fields', () => {
    const job = createJob();
    updateJob(job.id, { status: 'done' });
    expect(job.foundCount).toBe(0);
    expect(job.images).toEqual([]);
  });
});
