import React from 'react';
import { ImageCard } from './ImageCard.jsx';
import { zipUrl } from '../api.js';

export function ImageGallery({ job, isLoading }) {
  if (!job && !isLoading) return null;

  if (isLoading && (!job || job.status === 'pending')) {
    return <p style={{ color: '#64748b' }}>Scraping page…</p>;
  }

  if (job?.status === 'processing' || (isLoading && job?.status !== 'done')) {
    return (
      <p style={{ color: '#64748b' }}>
        Downloading… found {job?.foundCount ?? 0} image{job?.foundCount !== 1 ? 's' : ''}
      </p>
    );
  }

  if (job?.status === 'error') {
    return <p style={{ color: '#dc2626' }}>Error: {job.error}</p>;
  }

  if (job?.status === 'done') {
    const images = job.images ?? [];

    if (images.length === 0) {
      return <p style={{ color: '#64748b' }}>No images found on that page.</p>;
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ color: '#64748b' }}>{images.length} image{images.length !== 1 ? 's' : ''} found</span>
          <a
            href={zipUrl(job.id)}
            download
            style={{
              padding: '8px 16px',
              background: '#2563eb',
              color: '#fff',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Download All (ZIP)
          </a>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 16,
        }}>
          {images.map(img => <ImageCard key={img.filename} image={img} />)}
        </div>
      </div>
    );
  }

  return null;
}
