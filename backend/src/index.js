import express from 'express';
import cors from 'cors';
import { LocalStorageProvider } from './storage/LocalStorageProvider.js';
import { S3StorageProvider } from './storage/S3StorageProvider.js';
import { createRouter } from './routes/api.js';

const PORT = process.env.PORT || 3001;
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local';

const storage = STORAGE_PROVIDER === 's3'
  ? new S3StorageProvider()
  : new LocalStorageProvider();

console.log(`Storage provider: ${STORAGE_PROVIDER}`);

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api', createRouter(storage));

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

async function shutdown() {
  server.close();
  await storage.cleanup();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
