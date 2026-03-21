import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { StorageProvider } from './StorageProvider.js';

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION || 'us-east-1';

export class S3StorageProvider extends StorageProvider {
  constructor() {
    super();
    this.client = new S3Client({ region: REGION });
  }

  async upload(jobId, filename, buffer, contentType) {
    const key = `jobs/${jobId}/${filename}`;
    await this.client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
    return key;
  }

  getImageUrl(jobId, filename) {
    // Proxy through Express so client stays provider-agnostic
    return `/api/images/${jobId}/${encodeURIComponent(filename)}`;
  }

  async listImages(jobId) {
    const prefix = `jobs/${jobId}/`;
    const res = await this.client.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
    return (res.Contents || []).map(obj => ({
      filename: obj.Key.replace(prefix, ''),
      size: obj.Size,
      contentType: 'image/*', // would need HeadObject for exact type
      url: this.getImageUrl(jobId, obj.Key.replace(prefix, '')),
    }));
  }

  async deleteJob(jobId) {
    const prefix = `jobs/${jobId}/`;
    const list = await this.client.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
    if (!list.Contents?.length) return;
    await this.client.send(new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: list.Contents.map(o => ({ Key: o.Key })) },
    }));
  }

  /** Fetch object bytes from S3 (used by image proxy route). */
  async getObjectStream(jobId, filename) {
    const key = `jobs/${jobId}/${filename}`;
    const res = await this.client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return { stream: res.Body, contentType: res.ContentType };
  }
}
