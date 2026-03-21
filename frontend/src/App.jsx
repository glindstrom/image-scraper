import React, { useState } from 'react';
import { UrlInput } from './components/UrlInput.jsx';
import { ImageGallery } from './components/ImageGallery.jsx';
import { useJobPoller } from './hooks/useJobPoller.js';
import { startScrape } from './api.js';

export default function App() {
  const [jobId, setJobId] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { job, loading: polling, error: pollError } = useJobPoller(jobId);

  const isLoading = submitting || polling;

  async function handleSubmit(url) {
    setSubmitError(null);
    setJobId(null);
    setSubmitting(true);
    try {
      const { jobId: id } = await startScrape(url);
      setJobId(id);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ marginBottom: 24, fontSize: 28, fontWeight: 700 }}>Image Scraper</h1>
      <UrlInput onSubmit={handleSubmit} isLoading={isLoading} />
      {submitError && <p style={{ color: '#dc2626', marginBottom: 16 }}>{submitError}</p>}
      {pollError && <p style={{ color: '#dc2626', marginBottom: 16 }}>Polling error: {pollError}</p>}
      <ImageGallery job={job} isLoading={isLoading} />
    </div>
  );
}
