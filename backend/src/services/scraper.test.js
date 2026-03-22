import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { scrapeUrl } from './scraper.js';
import { updateJob } from './jobStore.js';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
vi.mock('./jobStore.js', () => ({ updateJob: vi.fn() }));

const mockStorage = {
  upload: vi.fn().mockResolvedValue('key'),
  getImageUrl: vi.fn().mockReturnValue('/api/images/job/photo.jpg'),
};

function makePageResponse(html) {
  return { data: html, headers: {}, status: 200 };
}

function makeImageResponse() {
  return {
    data: Buffer.from('fake image bytes'),
    headers: { 'content-type': 'image/jpeg' },
    status: 200,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.upload.mockResolvedValue('key');
  mockStorage.getImageUrl.mockReturnValue('/api/images/job/photo.jpg');
});

describe('scrapeUrl', () => {
  it('sets status to processing then done on success', async () => {
    const html = '<html><body><img src="https://example.com/photo.jpg"></body></html>';
    vi.mocked(axios.get)
      .mockResolvedValueOnce(makePageResponse(html))
      .mockResolvedValue(makeImageResponse());

    await scrapeUrl('job-1', 'https://example.com', mockStorage);

    expect(updateJob).toHaveBeenCalledWith('job-1', { status: 'processing' });
    expect(updateJob).toHaveBeenCalledWith('job-1', expect.objectContaining({ status: 'done' }));
  });

  it('uploads discovered images and includes them in done payload', async () => {
    const html = '<html><body><img src="https://example.com/photo.jpg"></body></html>';
    vi.mocked(axios.get)
      .mockResolvedValueOnce(makePageResponse(html))
      .mockResolvedValue(makeImageResponse());

    await scrapeUrl('job-1', 'https://example.com', mockStorage);

    expect(mockStorage.upload).toHaveBeenCalledTimes(1);
    const doneCall = vi.mocked(updateJob).mock.calls.find(
      ([, patch]) => patch.status === 'done'
    );
    expect(doneCall[1].images).toHaveLength(1);
  });

  it('resolves relative image URLs against the base URL', async () => {
    const html = '<html><body><img src="/images/logo.png"></body></html>';
    vi.mocked(axios.get)
      .mockResolvedValueOnce(makePageResponse(html))
      .mockResolvedValue(makeImageResponse());

    await scrapeUrl('job-2', 'https://example.com', mockStorage);

    const [downloadedUrl] = vi.mocked(axios.get).mock.calls[1];
    expect(downloadedUrl).toBe('https://example.com/images/logo.png');
  });

  it('collects images from srcset attributes', async () => {
    const html = '<html><body><img srcset="https://example.com/a.jpg 1x, https://example.com/b.jpg 2x"></body></html>';
    vi.mocked(axios.get)
      .mockResolvedValueOnce(makePageResponse(html))
      .mockResolvedValue(makeImageResponse());

    await scrapeUrl('job-3', 'https://example.com', mockStorage);

    expect(updateJob).toHaveBeenCalledWith('job-3', { foundCount: 2 });
    expect(mockStorage.upload).toHaveBeenCalledTimes(2);
  });

  it('collects og:image meta tag', async () => {
    const html = '<html><head><meta property="og:image" content="https://example.com/og.jpg"></head></html>';
    vi.mocked(axios.get)
      .mockResolvedValueOnce(makePageResponse(html))
      .mockResolvedValue(makeImageResponse());

    await scrapeUrl('job-4', 'https://example.com', mockStorage);

    expect(updateJob).toHaveBeenCalledWith('job-4', { foundCount: 1 });
  });

  it('collects lazy-loaded images from data-src and data-srcset', async () => {
    const html = `
      <html><body>
        <img src="placeholder.gif" data-src="https://example.com/lazy.jpg">
        <img data-srcset="https://example.com/lazy-2x.jpg 2x, https://example.com/lazy.jpg 1x">
        <img data-lazy-src="https://example.com/wp-lazy.jpg">
        <img data-original="https://example.com/jquery-lazy.jpg">
      </body></html>
    `;
    vi.mocked(axios.get)
      .mockResolvedValueOnce(makePageResponse(html))
      .mockResolvedValue(makeImageResponse());

    await scrapeUrl('job-lazy', 'https://example.com', mockStorage);

    // placeholder.gif + lazy.jpg + lazy-2x.jpg + lazy.jpg(dup) + wp-lazy.jpg + jquery-lazy.jpg
    // After dedup: placeholder.gif, lazy.jpg, lazy-2x.jpg, wp-lazy.jpg, jquery-lazy.jpg = 5
    expect(updateJob).toHaveBeenCalledWith('job-lazy', { foundCount: 5 });
  });

  it('skips data: URLs', async () => {
    const html = '<html><body><img src="data:image/gif;base64,abc"></body></html>';
    vi.mocked(axios.get).mockResolvedValueOnce(makePageResponse(html));

    await scrapeUrl('job-5', 'https://example.com', mockStorage);

    expect(updateJob).toHaveBeenCalledWith('job-5', { foundCount: 0 });
    expect(updateJob).toHaveBeenCalledWith('job-5', { status: 'done' });
    expect(mockStorage.upload).not.toHaveBeenCalled();
  });

  it('deduplicates identical image URLs', async () => {
    const html = `
      <html><body>
        <img src="https://example.com/photo.jpg">
        <img src="https://example.com/photo.jpg">
      </body></html>
    `;
    vi.mocked(axios.get)
      .mockResolvedValueOnce(makePageResponse(html))
      .mockResolvedValue(makeImageResponse());

    await scrapeUrl('job-6', 'https://example.com', mockStorage);

    expect(updateJob).toHaveBeenCalledWith('job-6', { foundCount: 1 });
    expect(mockStorage.upload).toHaveBeenCalledTimes(1);
  });

  it('sets status to error when page fetch fails', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'));

    await scrapeUrl('job-7', 'https://example.com', mockStorage);

    expect(updateJob).toHaveBeenCalledWith('job-7', expect.objectContaining({
      status: 'error',
      error: expect.stringContaining('Failed to fetch page'),
    }));
    expect(mockStorage.upload).not.toHaveBeenCalled();
  });

  it('completes successfully even when individual image downloads fail', async () => {
    const html = `
      <html><body>
        <img src="https://example.com/ok.jpg">
        <img src="https://example.com/fail.jpg">
      </body></html>
    `;
    vi.mocked(axios.get)
      .mockResolvedValueOnce(makePageResponse(html))
      .mockResolvedValueOnce(makeImageResponse())   // ok.jpg succeeds
      .mockRejectedValueOnce(new Error('timeout')); // fail.jpg fails

    await scrapeUrl('job-8', 'https://example.com', mockStorage);

    // Job still completes
    expect(updateJob).toHaveBeenCalledWith('job-8', expect.objectContaining({ status: 'done' }));
    // Only the successful image is included
    const doneCall = vi.mocked(updateJob).mock.calls.find(([, p]) => p.status === 'done');
    expect(doneCall[1].images).toHaveLength(1);
  });
});
