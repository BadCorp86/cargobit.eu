/**
 * CargoBit Multipart S3 Upload Service
 * Initiative 4: Ops Load Test Plan - Multipart S3 Flow
 * 
 * Provides streaming multipart uploads for large exports,
 * with configurable chunk sizes, retry logic, and monitoring.
 */

import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { Readable, PassThrough } from 'stream';
import { register, Counter, Histogram, Gauge } from 'prom-client';

// =============================================================================
// TYPES
// =============================================================================

export interface MultipartUploadConfig {
    bucket: string;
    key: string;
    contentType: string;
    metadata?: Record<string, string>;
    partSize?: number;  // Default: 5MB, Min: 5MB, Max: 100MB
    maxConcurrency?: number;  // Default: 5
    maxRetries?: number;  // Default: 3
    timeout?: number;  // Default: 300000 (5 minutes)
}

export interface UploadProgress {
    uploadId: string;
    key: string;
    bytesUploaded: number;
    totalBytes?: number;
    partsCompleted: number;
    partsTotal: number;
    percentComplete: number;
    startedAt: Date;
    estimatedTimeRemaining?: number;
}

export interface CompletedUpload {
    bucket: string;
    key: string;
    etag: string;
    location: string;
    size: number;
    partsCount: number;
    duration: number;
}

// =============================================================================
// PROMETHEUS METRICS
// =============================================================================

const multipartUploadsStarted = new Counter({
    name: 'multipart_uploads_started_total',
    help: 'Total multipart uploads started',
    labelNames: ['bucket'],
});

const multipartUploadsCompleted = new Counter({
    name: 'multipart_uploads_completed_total',
    help: 'Total multipart uploads completed',
    labelNames: ['bucket', 'status'],
});

const multipartUploadParts = new Counter({
    name: 'multipart_upload_parts_total',
    help: 'Total parts uploaded in multipart uploads',
    labelNames: ['bucket', 'status'],
});

const multipartUploadDuration = new Histogram({
    name: 'multipart_upload_duration_seconds',
    help: 'Duration of multipart uploads',
    labelNames: ['bucket', 'size_bucket'],
    buckets: [10, 30, 60, 120, 300, 600, 1200, 1800, 3600],
});

const multipartUploadSize = new Histogram({
    name: 'multipart_upload_size_bytes',
    help: 'Size of multipart uploads',
    labelNames: ['bucket'],
    buckets: [
        1024 * 1024,          // 1MB
        10 * 1024 * 1024,     // 10MB
        50 * 1024 * 1024,     // 50MB
        100 * 1024 * 1024,    // 100MB
        500 * 1024 * 1024,    // 500MB
        1024 * 1024 * 1024,   // 1GB
        5 * 1024 * 1024 * 1024,  // 5GB
        10 * 1024 * 1024 * 1024, // 10GB
    ],
});

const multipartUploadRetries = new Counter({
    name: 'multipart_upload_retries_total',
    help: 'Total retry attempts for multipart uploads',
    labelNames: ['bucket'],
});

const multipartUploadsInProgress = new Gauge({
    name: 'multipart_uploads_in_progress',
    help: 'Current multipart uploads in progress',
    labelNames: ['bucket'],
});

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG = {
    partSize: 5 * 1024 * 1024,  // 5MB (AWS minimum)
    maxConcurrency: 5,
    maxRetries: 3,
    timeout: 300000,  // 5 minutes
};

// =============================================================================
// SERVICE CLASS
// =============================================================================

export class MultipartUploadService {
    private s3Client: S3Client;
    private bucketName: string;
    private activeUploads: Map<string, UploadProgress> = new Map();

    constructor() {
        this.bucketName = process.env.EXPORT_BUCKET || 'cargobit-exports';
        
        this.s3Client = new S3Client({
            region: process.env.AWS_REGION || 'eu-central-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            },
            maxAttempts: 3,
        });
    }

    // =========================================================================
    // PUBLIC METHODS
    // =========================================================================

    /**
     * Upload a stream using multipart upload
     */
    async uploadStream(
        stream: Readable,
        config: MultipartUploadConfig
    ): Promise<CompletedUpload> {
        const startTime = Date.now();
        const partSize = config.partSize || DEFAULT_CONFIG.partSize;
        const maxRetries = config.maxRetries || DEFAULT_CONFIG.maxRetries;

        let uploadId: string | undefined;
        const parts: Array<{ PartNumber: number; ETag: string }> = [];
        let buffer = Buffer.alloc(0);
        let partNumber = 0;
        let bytesUploaded = 0;

        const progress: UploadProgress = {
            uploadId: '',
            key: config.key,
            bytesUploaded: 0,
            partsCompleted: 0,
            partsTotal: 0,
            percentComplete: 0,
            startedAt: new Date(),
        };

        try {
            // 1. Initialize multipart upload
            const initResponse = await this.s3Client.send(
                new CreateMultipartUploadCommand({
                    Bucket: config.bucket || this.bucketName,
                    Key: config.key,
                    ContentType: config.contentType,
                    Metadata: config.metadata,
                })
            );

            uploadId = initResponse.UploadId;
            progress.uploadId = uploadId!;
            this.activeUploads.set(uploadId!, progress);

            multipartUploadsStarted.inc({ bucket: config.bucket || this.bucketName });
            multipartUploadsInProgress.inc({ bucket: config.bucket || this.bucketName });

            // 2. Process stream and upload parts
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);

                while (buffer.length >= partSize) {
                    partNumber++;
                    const partData = buffer.slice(0, partSize);
                    buffer = buffer.slice(partSize);

                    const etag = await this.uploadPartWithRetry(
                        config.bucket || this.bucketName,
                        config.key,
                        uploadId!,
                        partNumber,
                        partData,
                        maxRetries
                    );

                    parts.push({ PartNumber: partNumber, ETag: etag });
                    bytesUploaded += partData.length;

                    progress.bytesUploaded = bytesUploaded;
                    progress.partsCompleted = parts.length;
                    progress.partsTotal = partNumber;
                    progress.percentComplete = 50; // Estimated

                    multipartUploadParts.inc({
                        bucket: config.bucket || this.bucketName,
                        status: 'success',
                    });
                }
            }

            // 3. Upload remaining buffer as final part
            if (buffer.length > 0) {
                partNumber++;
                const etag = await this.uploadPartWithRetry(
                    config.bucket || this.bucketName,
                    config.key,
                    uploadId!,
                    partNumber,
                    buffer,
                    maxRetries
                );

                parts.push({ PartNumber: partNumber, ETag: etag });
                bytesUploaded += buffer.length;

                multipartUploadParts.inc({
                    bucket: config.bucket || this.bucketName,
                    status: 'success',
                });
            }

            // 4. Complete multipart upload
            const completeResponse = await this.s3Client.send(
                new CompleteMultipartUploadCommand({
                    Bucket: config.bucket || this.bucketName,
                    Key: config.key,
                    UploadId: uploadId,
                    MultipartUpload: { Parts: parts },
                })
            );

            const duration = (Date.now() - startTime) / 1000;

            // Record metrics
            multipartUploadsCompleted.inc({
                bucket: config.bucket || this.bucketName,
                status: 'success',
            });
            multipartUploadDuration.observe(
                { bucket: config.bucket || this.bucketName, size_bucket: this.getSizeBucket(bytesUploaded) },
                duration
            );
            multipartUploadSize.observe(
                { bucket: config.bucket || this.bucketName },
                bytesUploaded
            );
            multipartUploadsInProgress.dec({ bucket: config.bucket || this.bucketName });

            this.activeUploads.delete(uploadId!);

            return {
                bucket: config.bucket || this.bucketName,
                key: config.key,
                etag: completeResponse.ETag || '',
                location: completeResponse.Location || '',
                size: bytesUploaded,
                partsCount: parts.length,
                duration,
            };
        } catch (error) {
            // Abort multipart upload on failure
            if (uploadId) {
                try {
                    await this.s3Client.send(
                        new AbortMultipartUploadCommand({
                            Bucket: config.bucket || this.bucketName,
                            Key: config.key,
                            UploadId: uploadId,
                        })
                    );
                } catch (abortError) {
                    console.error('Failed to abort multipart upload:', abortError);
                }

                this.activeUploads.delete(uploadId);
                multipartUploadsInProgress.dec({ bucket: config.bucket || this.bucketName });
            }

            multipartUploadsCompleted.inc({
                bucket: config.bucket || this.bucketName,
                status: 'failed',
            });

            throw error;
        }
    }

    /**
     * Upload buffer/string data using multipart upload for large payloads
     */
    async uploadData(
        data: Buffer | string,
        config: MultipartUploadConfig
    ): Promise<CompletedUpload> {
        const buffer = typeof data === 'string' ? Buffer.from(data) : data;
        const partSize = config.partSize || DEFAULT_CONFIG.partSize;

        // Use simple put for small files
        if (buffer.length < partSize) {
            return this.uploadSingle(buffer, config);
        }

        // Create readable stream from buffer
        const stream = Readable.from(buffer);
        return this.uploadStream(stream, config);
    }

    /**
     * Get upload progress
     */
    getUploadProgress(uploadId: string): UploadProgress | undefined {
        return this.activeUploads.get(uploadId);
    }

    /**
     * Get all active uploads
     */
    getActiveUploads(): UploadProgress[] {
        return Array.from(this.activeUploads.values());
    }

    /**
     * Abort an upload
     */
    async abortUpload(
        bucket: string,
        key: string,
        uploadId: string
    ): Promise<void> {
        await this.s3Client.send(
            new AbortMultipartUploadCommand({
                Bucket: bucket || this.bucketName,
                Key: key,
                UploadId: uploadId,
            })
        );

        this.activeUploads.delete(uploadId);
        multipartUploadsInProgress.dec({ bucket: bucket || this.bucketName });
    }

    // =========================================================================
    // PRIVATE METHODS
    // =========================================================================

    private async uploadSingle(
        data: Buffer,
        config: MultipartUploadConfig
    ): Promise<CompletedUpload> {
        const startTime = Date.now();

        await this.s3Client.send(
            new PutObjectCommand({
                Bucket: config.bucket || this.bucketName,
                Key: config.key,
                Body: data,
                ContentType: config.contentType,
                Metadata: config.metadata,
            })
        );

        const duration = (Date.now() - startTime) / 1000;

        return {
            bucket: config.bucket || this.bucketName,
            key: config.key,
            etag: '',
            location: `https://${config.bucket || this.bucketName}.s3.amazonaws.com/${config.key}`,
            size: data.length,
            partsCount: 1,
            duration,
        };
    }

    private async uploadPartWithRetry(
        bucket: string,
        key: string,
        uploadId: string,
        partNumber: number,
        data: Buffer,
        maxRetries: number
    ): Promise<string> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.s3Client.send(
                    new UploadPartCommand({
                        Bucket: bucket,
                        Key: key,
                        UploadId: uploadId,
                        PartNumber: partNumber,
                        Body: data,
                    })
                );

                return response.ETag || '';
            } catch (error: any) {
                lastError = error;
                
                if (attempt < maxRetries) {
                    // Exponential backoff
                    const delay = Math.pow(2, attempt) * 100;
                    await new Promise(resolve => setTimeout(resolve, delay));

                    multipartUploadRetries.inc({ bucket });
                    multipartUploadParts.inc({ bucket, status: 'retry' });
                }
            }
        }

        throw lastError || new Error('Upload part failed');
    }

    private getSizeBucket(bytes: number): string {
        const mb = bytes / (1024 * 1024);
        if (mb < 10) return 'small';
        if (mb < 100) return 'medium';
        if (mb < 1000) return 'large';
        if (mb < 5000) return 'xlarge';
        return 'huge';
    }
}

// =============================================================================
// CSV STREAM GENERATOR
// =============================================================================

/**
 * Generate CSV stream from data for large exports
 */
export class CsvStreamGenerator {
    static createStream(
        dataGenerator: AsyncGenerator<Record<string, any>>,
        options: {
            headers?: string[];
            delimiter?: string;
            batchSize?: number;
        } = {}
    ): Readable {
        const delimiter = options.delimiter || ',';
        const batchSize = options.batchSize || 1000;
        let headers: string[] | null = options.headers || null;
        let isFirst = true;

        const stream = new Readable({
            objectMode: false,
            read() {},
        });

        (async () => {
            try {
                let batch: string[] = [];

                for await (const row of dataGenerator) {
                    // Set headers from first row
                    if (!headers) {
                        headers = Object.keys(row);
                        stream.push(headers.join(delimiter) + '\n');
                    }

                    // Format row
                    const values = headers.map(h => this.formatValue(row[h]));
                    batch.push(values.join(delimiter));

                    // Push batch when size reached
                    if (batch.length >= batchSize) {
                        stream.push(batch.join('\n') + '\n');
                        batch = [];
                    }
                }

                // Push remaining batch
                if (batch.length > 0) {
                    stream.push(batch.join('\n') + '\n');
                }

                stream.push(null); // End stream
            } catch (error) {
                stream.destroy(error as Error);
            }
        })();

        return stream;
    }

    private static formatValue(value: any): string {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // Escape quotes and wrap in quotes if contains delimiter or newline
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }
}

// Export singleton
export const multipartUploadService = new MultipartUploadService();
