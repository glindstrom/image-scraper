/**
 * Abstract base class for storage providers.
 * Swap implementations via STORAGE_PROVIDER env var.
 */
export class StorageProvider {
  /** @returns {Promise<string>} key */
  async upload(jobId, filename, buffer, contentType) {
    throw new Error('Not implemented');
  }

  /** @returns {string} URL */
  getImageUrl(jobId, filename) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<Array<{filename, contentType, size, url}>>} */
  async listImages(jobId) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<void>} */
  async deleteJob(jobId) {
    throw new Error('Not implemented');
  }
}
