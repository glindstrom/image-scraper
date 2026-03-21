import React, { useState } from 'react';

export function UrlInput({ onSubmit, isLoading }) {
  const [value, setValue] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
      <input
        type="url"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="https://example.com"
        required
        disabled={isLoading}
        style={{
          flex: 1,
          padding: '10px 14px',
          fontSize: 16,
          borderRadius: 6,
          border: '1px solid #ccc',
          outline: 'none',
        }}
      />
      <button
        type="submit"
        disabled={isLoading}
        style={{
          padding: '10px 20px',
          fontSize: 16,
          borderRadius: 6,
          border: 'none',
          background: '#2563eb',
          color: '#fff',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {isLoading ? 'Scraping…' : 'Scrape'}
      </button>
    </form>
  );
}
