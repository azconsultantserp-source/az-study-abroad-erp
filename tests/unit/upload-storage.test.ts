import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
  class FakeS3Client {
    send = h.send;
  }
  return {
    S3Client: FakeS3Client,
    PutObjectCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    GetObjectCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    HeadObjectCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

import {
  getStorageBackend,
  validateMagicBytes,
  saveUploadedFile,
  readStoredFile,
} from "@/lib/upload";

const ORIG: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of [
    "STORAGE_BACKEND",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_ENDPOINT",
  ]) {
    ORIG[key] = process.env[key];
    delete process.env[key];
  }
  h.send.mockReset();
});

afterEach(() => {
  for (const [key, value] of Object.entries(ORIG)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("getStorageBackend", () => {
  it("defaults to local", () => {
    expect(getStorageBackend()).toBe("local");
  });

  it("selects r2 when configured", () => {
    process.env.STORAGE_BACKEND = "r2";
    expect(getStorageBackend()).toBe("r2");
  });
});

describe("validateMagicBytes", () => {
  it("accepts a PDF header", () => {
    expect(validateMagicBytes(Buffer.from("%PDF-1.4"), "application/pdf")).toBe(true);
  });

  it("rejects a fake PDF", () => {
    expect(validateMagicBytes(Buffer.from("not-a-pdf"), "application/pdf")).toBe(false);
  });
});

describe("saveUploadedFile + readStoredFile (R2)", () => {
  function setR2Env() {
    process.env.STORAGE_BACKEND = "r2";
    process.env.R2_ACCOUNT_ID = "acct123";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    process.env.R2_BUCKET = "az-erp-documents";
  }

  it("puts an object into R2 and stores a relative key", async () => {
    setR2Env();
    h.send.mockResolvedValueOnce({});

    const pdf = new File([Buffer.from("%PDF-1.7 mock")], "offer.pdf", {
      type: "application/pdf",
    });

    const saved = await saveUploadedFile(pdf);

    expect(saved.fileName).toBe("offer.pdf");
    expect(saved.mimeType).toBe("application/pdf");
    expect(saved.filePath.startsWith("documents/")).toBe(true);
    expect(saved.filePath.endsWith(".pdf")).toBe(true);
    expect(h.send).toHaveBeenCalledOnce();
  });

  it("reads an object back from R2", async () => {
    setR2Env();
    const payload = Buffer.from("%PDF-bytes");
    h.send.mockResolvedValueOnce({
      Body: {
        transformToByteArray: async () => new Uint8Array(payload),
      },
    });

    const buf = await readStoredFile("documents/abc.pdf");
    expect(buf.equals(payload)).toBe(true);
  });

  it("throws when R2 env is incomplete", async () => {
    process.env.STORAGE_BACKEND = "r2";
    const pdf = new File([Buffer.from("%PDF-1.7")], "x.pdf", { type: "application/pdf" });
    await expect(saveUploadedFile(pdf)).rejects.toThrow(/R2 storage is not configured/);
  });
});
