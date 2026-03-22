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

  it('picks the highest-descriptor URL from srcset, ignoring src fallback', async () => {
    const html = '<html><body><img src="https://example.com/a.jpg" srcset="https://example.com/a.jpg 1x, https://example.com/b.jpg 2x"></body></html>';
    vi.mocked(axios.get)
      .mockResolvedValueOnce(makePageResponse(html))
      .mockResolvedValue(makeImageResponse());

    await scrapeUrl('job-3', 'https://example.com', mockStorage);

    // Only b.jpg (2x) — src and 1x variant are skipped
    expect(updateJob).toHaveBeenCalledWith('job-3', { foundCount: 1 });
    expect(mockStorage.upload).toHaveBeenCalledTimes(1);
    expect(vi.mocked(mockStorage.upload).mock.calls[0][1]).toBe('b.jpg');
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

    // placeholder.gif (src, no srcset) + lazy.jpg (data-src) + lazy-2x.jpg (best from data-srcset,
    // 1x variant dropped) + wp-lazy.jpg + jquery-lazy.jpg = 5; lazy.jpg dup from data-srcset deduped
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

  it('assigns unique filenames to images from the same CDN domain (regression: base64 prefix collision)', async () => {
    // Aftonbladet serves images via Akamai with no file extension in the URL path,
    // so all filenames fall through to the hash fallback. The old approach used
    // Buffer.from(url).toString('base64url').slice(0, 16) which only encoded the
    // first 12 URL characters — identical for every URL on the same CDN host —
    // producing the same filename (aHR0cHM6Ly9ha2Ft.jpeg) for all of them.
    // Aftonbladet serves images via Akamai with no file extension in the URL path,
    // so all filenames fall through to the hash fallback. The old approach used
    // Buffer.from(url).toString('base64url').slice(0, 16) which only encoded the
    // first 12 URL characters — identical for every URL on the same CDN host —
    // producing the same filename (aHR0cHM6Ly9ha2Ft.jpeg) for all of them.
    const html = `
      <html><body>
        <img src="https://akamai.aftonbladet-cdn.se/image/policy:1234">
        <img src="https://akamai.aftonbladet-cdn.se/image/policy:5678">
        <img src="https://akamai.aftonbladet-cdn.se/image/policy:9012">
      </body></html>
    `;
    vi.mocked(axios.get)
      .mockResolvedValueOnce(makePageResponse(html))
      .mockResolvedValue(makeImageResponse());

    await scrapeUrl('job-cdn', 'https://aftonbladet.se', mockStorage);

    expect(mockStorage.upload).toHaveBeenCalledTimes(3);
    const filenames = vi.mocked(mockStorage.upload).mock.calls.map(([, filename]) => filename);
    expect(new Set(filenames).size).toBe(3);
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
