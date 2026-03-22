function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageCard({ image }) {
  return (
    <div style={{
      border: '1px solid #e2e8f0',
      borderRadius: 8,
      overflow: 'hidden',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ height: 160, background: '#f8fafc', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={image.url}
          alt={image.filename}
          loading="lazy"
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      </div>
      <div style={{ padding: '8px 10px', fontSize: 12, color: '#64748b' }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }} title={image.filename}>
          {image.filename}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{humanSize(image.size)}</span>
          <a
            href={image.url}
            download={image.filename}
            style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
          >
            Download
          </a>
        </div>
      </div>
    </div>
  );
}
