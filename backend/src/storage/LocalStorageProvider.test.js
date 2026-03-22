import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { LocalStorageProvider } from './LocalStorageProvider.js';

const provider = new LocalStorageProvider();
const createdJobIds = [];

afterEach(async () => {
  for (const jobId of createdJobIds.splice(0)) {
    await provider.deleteJob(jobId).catch(() => {});
  }
});

function newJobId() {
  const id = randomUUID();
  createdJobIds.push(id);
  return id;
}

describe('LocalStorageProvider', () => {
  it('upload stores a file and returns the storage key', async () => {
    const jobId = newJobId();
    const key = await provider.upload(jobId, 'test.jpg', Buffer.from('data'), 'image/jpeg');
    expect(key).toBe(`${jobId}/test.jpg`);
  });

  it('listImages returns uploaded images with metadata', async () => {
    const jobId = newJobId();
    const buf = Buffer.from('image bytes');
    await provider.upload(jobId, 'a.jpg', buf, 'image/jpeg');
    await provider.upload(jobId, 'b.png', buf, 'image/png');

    const images = await provider.listImages(jobId);
    expect(images).toHaveLength(2);
    const filenames = images.map(i => i.filename);
    expect(filenames).toContain('a.jpg');
    expect(filenames).toContain('b.png');
    expect(images[0]).toMatchObject({
      filename: expect.any(String),
      contentType: expect.any(String),
      size: buf.length,
      url: expect.stringContaining('/api/images/'),
    });
  });

  it('listImages returns empty array for unknown jobId', async () => {
    const images = await provider.listImages(randomUUID());
    expect(images).toEqual([]);
  });

  it('upload overwrites the meta entry when filename is repeated', async () => {
    const jobId = newJobId();
    await provider.upload(jobId, 'img.jpg', Buffer.from('v1'), 'image/jpeg');
    await provider.upload(jobId, 'img.jpg', Buffer.from('v2!!'), 'image/jpeg');

    const images = await provider.listImages(jobId);
    expect(images).toHaveLength(1);
    expect(images[0].size).toBe(4); // 'v2!!' is 4 bytes
  });

  it('getImageUrl returns the correct proxied API path', () => {
    const jobId = 'test-job';
    const url = provider.getImageUrl(jobId, 'photo.jpg');
    expect(url).toBe('/api/images/test-job/photo.jpg');
  });

  it('getImageUrl URL-encodes special characters in filename', () => {
    const url = provider.getImageUrl('job', 'héllo wörld.jpg');
    expect(url).toBe('/api/images/job/h%C3%A9llo%20w%C3%B6rld.jpg');
  });

  it('getFilePath returns a path containing jobId and filename', async () => {
    const jobId = newJobId();
    await provider.upload(jobId, 'img.jpg', Buffer.from('x'), 'image/jpeg');
    const filePath = await provider.getFilePath(jobId, 'img.jpg');
    expect(filePath).toContain(jobId);
    expect(filePath).toContain('img.jpg');
  });

  it('deleteJob removes all stored files', async () => {
    const jobId = randomUUID(); // manage cleanup manually
    await provider.upload(jobId, 'img.jpg', Buffer.from('x'), 'image/jpeg');
    await provider.deleteJob(jobId);
    const images = await provider.listImages(jobId);
    expect(images).toEqual([]);
  });
});
