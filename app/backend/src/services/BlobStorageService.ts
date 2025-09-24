import {
  BlobServiceClient,
  ContainerClient,
  BlockBlobClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';

export interface IBlobStorageService {
  exists(blobPath: string): Promise<boolean>;
  uploadBlob(blobPath: string, content: Buffer | string, contentType?: string): Promise<string>;
  downloadBlob(blobPath: string): Promise<Buffer | null>;
  generateSasUrl(blobPath: string, expiryMinutes?: number): Promise<string>;
  listBlobs(prefix: string): Promise<string[]>;
  deleteBlob(blobPath: string): Promise<boolean>;
}

export class BlobStorageService implements IBlobStorageService {
  private blobServiceClient?: BlobServiceClient;
  private containerClient?: ContainerClient;
  private accountName?: string;
  private accountKey?: string;

  // Stash raw inputs; don’t initialize at module load
  private readonly containerName: string;
  private readonly connectionString?: string;

  /**
   * Make connectionString optional.
   * If omitted or invalid, the service behaves as "disabled":
   * - read-only calls return safe defaults
   * - mutating calls (upload/delete/SAS) throw clear errors
   */
  constructor(connectionString?: string, containerName: string = 'cards') {
    // You can also choose to fallback to env here if desired:
    // connectionString ||= process.env.BLOB_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
    this.connectionString = connectionString;
    this.containerName = containerName;
  }

  // Lazily initialize only if we have a valid connection string
  private async initIfConfigured(): Promise<boolean> {
    if (this.blobServiceClient && this.containerClient) return true;

    const cs = (this.connectionString || '').trim();
    // Classic connection-string quick sanity check
    const looksValid = /DefaultEndpointsProtocol=/i.test(cs) &&
                       /AccountName=/i.test(cs) &&
                       /AccountKey=/i.test(cs);

    if (!looksValid) {
      return false; // treat as unconfigured
    }

    try {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(cs);
      this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);

      // Extract account name/key for SAS generation
      const parts = cs.split(';');
      const namePart = parts.find(p => p.startsWith('AccountName=')) ?? '';
      const keyPart  = parts.find(p => p.startsWith('AccountKey=')) ?? '';
      this.accountName = namePart.split('=')[1] ?? '';
      this.accountKey  = keyPart.split('=')[1] ?? '';

      // Best-effort container creation; don’t fail startup on conflicts
      await this.containerClient.createIfNotExists();
      return true;
    } catch (err) {
      // If something goes wrong, stay "unconfigured" and let callers decide
      console.error(`[BlobStorageService] initialization failed:`, err);
      this.blobServiceClient = undefined;
      this.containerClient = undefined;
      this.accountName = undefined;
      this.accountKey = undefined;
      return false;
    }
  }

  private requireConfigured(action: string): never {
    throw new Error(
      `Blob storage is not configured; cannot ${action}. ` +
      `Provide a valid connection string or disable blob features.`
    );
  }

  async exists(blobPath: string): Promise<boolean> {
    if (!(await this.initIfConfigured())) return false;
    const blockBlobClient = this.containerClient!.getBlockBlobClient(blobPath);
    return blockBlobClient.exists();
    }

  async uploadBlob(blobPath: string, content: Buffer | string, contentType?: string): Promise<string> {
    if (!(await this.initIfConfigured())) this.requireConfigured('upload blobs');
    const blockBlobClient = this.containerClient!.getBlockBlobClient(blobPath);
    const options = contentType ? { blobHTTPHeaders: { blobContentType: contentType } } : undefined;
    if (typeof content === 'string') {
      await blockBlobClient.upload(content, Buffer.byteLength(content), options);
    } else {
      await blockBlobClient.upload(content, content.length, options);
    }
    return blockBlobClient.url;
  }

  async downloadBlob(blobPath: string): Promise<Buffer | null> {
    if (!(await this.initIfConfigured())) return null;
    const blockBlobClient = this.containerClient!.getBlockBlobClient(blobPath);
    if (!(await blockBlobClient.exists())) return null;

    const res = await blockBlobClient.download(0);
    if (!res.readableStreamBody) return null;

    const chunks: Buffer[] = [];
    for await (const chunk of res.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async generateSasUrl(blobPath: string, expiryMinutes: number = 60): Promise<string> {
    if (!(await this.initIfConfigured())) this.requireConfigured('generate SAS URLs');
    if (!this.accountName || !this.accountKey) this.requireConfigured('generate SAS URLs');

    const sharedKey = new StorageSharedKeyCredential(this.accountName, this.accountKey);
    const blockBlobClient = this.containerClient!.getBlockBlobClient(blobPath);

    const expiresOn = new Date(Date.now() + expiryMinutes * 60_000);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: this.containerClient!.containerName,
        blobName: blobPath,
        permissions: BlobSASPermissions.parse('r'),
        startsOn: new Date(),
        expiresOn,
      },
      sharedKey
    ).toString();

    return `${blockBlobClient.url}?${sas}`;
  }

  async listBlobs(prefix: string): Promise<string[]> {
    if (!(await this.initIfConfigured())) return [];
    const blobs: string[] = [];
    for await (const blob of this.containerClient!.listBlobsFlat({ prefix })) {
      blobs.push(blob.name);
    }
    return blobs;
  }

  async deleteBlob(blobPath: string): Promise<boolean> {
    if (!(await this.initIfConfigured())) this.requireConfigured('delete blobs');
    const resp = await this.containerClient!.getBlockBlobClient(blobPath).deleteIfExists();
    return resp.succeeded;
  }
}
