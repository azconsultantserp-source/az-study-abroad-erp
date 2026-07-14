/**
 * Document binary storage.
 *
 * - STORAGE_BACKEND=local (default): disk under UPLOAD_DIR (good for local PC)
 * - STORAGE_BACKEND=r2: Cloudflare R2 private bucket (production on Hostinger)
 *
 * The DB always stores a relative object key / path like `documents/<uuid>.pdf`.
 * Downloads stay behind authenticated API routes — objects are never public.
 */
import { writeFile, mkdir, readFile, stat } from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { AppError } from "@/lib/api-auth";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export type StorageBackend = "local" | "r2";

export function getStorageBackend(): StorageBackend {
  const raw = (process.env.STORAGE_BACKEND || "local").toLowerCase().trim();
  return raw === "r2" ? "r2" : "local";
}

function requireR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const endpoint =
    process.env.R2_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

  if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) {
    throw new AppError(
      "R2 storage is not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_ACCOUNT_ID (or R2_ENDPOINT).",
      500
    );
  }

  return { accessKeyId, secretAccessKey, bucket, endpoint };
}

let cachedClient: S3Client | null = null;

function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;
  const { accessKeyId, secretAccessKey, endpoint } = requireR2Config();
  cachedClient = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

/** Verify file content matches declared MIME type using magic bytes. */
export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;
  if (mimeType === "application/pdf") {
    return buffer.subarray(0, 4).toString("ascii") === "%PDF";
  }
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  }
  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    return buffer[0] === 0x50 && buffer[1] === 0x4b;
  }
  return true;
}

function assertSafeRelativeKey(relativePath: string): string {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new AppError("Invalid file path", 403);
  }
  const normalized = path.normalize(relativePath).replace(/\\/g, "/");
  if (normalized.startsWith("..") || normalized.includes("../") || normalized.includes("..\\")) {
    throw new AppError("Invalid file path", 403);
  }
  return normalized;
}

export async function saveUploadedFile(
  file: File,
  subfolder: string = "documents"
): Promise<{ fileName: string; filePath: string; fileSize: number; mimeType: string }> {
  if (file.size > MAX_FILE_SIZE) {
    throw new AppError("File size exceeds 10MB limit", 413);
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new AppError("File type not allowed. Use PDF, JPG, PNG, or DOC/DOCX", 415);
  }

  const ext = path.extname(file.name) || ".bin";
  const uniqueName = `${randomUUID()}${ext}`;
  const relativeKey = path.join(subfolder, uniqueName).replace(/\\/g, "/");
  const buffer = Buffer.from(await file.arrayBuffer());

  if (!validateMagicBytes(buffer, file.type)) {
    throw new AppError(
      "File content does not match its type. Upload a valid PDF, image, or Word document.",
      415
    );
  }

  if (getStorageBackend() === "r2") {
    const { bucket } = requireR2Config();
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: relativeKey,
        Body: buffer,
        ContentType: file.type,
        ContentLength: buffer.length,
      })
    );
  } else {
    const uploadPath = path.join(UPLOAD_DIR, subfolder);
    await mkdir(uploadPath, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, relativeKey), buffer);
  }

  return {
    fileName: file.name,
    filePath: relativeKey,
    fileSize: file.size,
    mimeType: file.type,
  };
}

/** Absolute disk path for local backend only (legacy helper). */
export function getAbsoluteFilePath(relativePath: string): string {
  const normalized = assertSafeRelativeKey(relativePath);
  const base = path.resolve(UPLOAD_DIR);
  const resolved = path.resolve(base, normalized);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new AppError("Invalid file path", 403);
  }
  return resolved;
}

/** Read a stored document into a Buffer (download path). */
export async function readStoredFile(relativePath: string): Promise<Buffer> {
  const key = assertSafeRelativeKey(relativePath);

  if (getStorageBackend() === "r2") {
    const { bucket } = requireR2Config();
    const result = await getR2Client().send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );
    if (!result.Body) {
      throw new AppError("File not found in storage", 404);
    }
    const bytes = await result.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  return readFile(getAbsoluteFilePath(key));
}

/**
 * Return a Node readable stream for ZIP archiving.
 * Caller must handle missing objects (returns null if not found).
 */
export async function openStoredFileStream(
  relativePath: string
): Promise<Readable | null> {
  const key = assertSafeRelativeKey(relativePath);

  if (getStorageBackend() === "r2") {
    const { bucket } = requireR2Config();
    try {
      await getR2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    } catch {
      return null;
    }
    const result = await getR2Client().send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );
    if (!result.Body) return null;
    // AWS SDK v3 Body is async iterable / web stream — convert to Node Readable.
    return Readable.fromWeb(result.Body.transformToWebStream() as import("stream/web").ReadableStream);
  }

  const absolute = getAbsoluteFilePath(key);
  try {
    await stat(absolute);
  } catch {
    return null;
  }
  return createReadStream(absolute);
}

/**
 * Builds a safe `Content-Disposition` filename directive. Strips CR/LF/quotes
 * to prevent HTTP response-header injection and uses RFC 5987 encoding so
 * non-ASCII filenames survive.
 */
export function contentDispositionFilename(fileName: string): string {
  const fallback = fileName
    .replace(/[\r\n"\\]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, escape);
  return `filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
