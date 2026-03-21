export async function startScrape(url) {
  const res = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error || 'Request failed');
  }
  return res.json(); // { jobId }
}

export async function getJob(jobId) {
  const res = await fetch(`/api/jobs/${jobId}`);
  if (!res.ok) throw new Error('Failed to fetch job');
  return res.json();
}

export function zipUrl(jobId) {
  return `/api/jobs/${jobId}/zip`;
}
