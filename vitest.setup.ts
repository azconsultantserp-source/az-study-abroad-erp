import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Stable secret so credential-vault encryption is deterministic in tests.
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? "test-secret-value-at-least-32-chars-long-ok";
process.env.AUTH_URL = process.env.AUTH_URL ?? "http://localhost:3000";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
