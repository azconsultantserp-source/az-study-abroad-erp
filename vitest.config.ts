import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Playwright specs live in e2e/ and run with their own runner.
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      // Scope coverage to the modules we exercise with unit/integration tests
      // so the threshold below is meaningful. Server React pages and remaining
      // API routes are validated via the Playwright E2E suite instead.
      include: [
        "src/lib/utils.ts",
        "src/lib/pagination.ts",
        "src/lib/parse-document-requirements.ts",
        "src/lib/validators.ts",
        "src/lib/security.ts",
        "src/lib/rate-limit.ts",
        "src/lib/credential-vault.ts",
        "src/lib/rbac.ts",
        "src/lib/constants.ts",
        "src/lib/api-auth.ts",
        "src/app/api/health/route.ts",
        "src/app/api/stages/[id]/route.ts",
      ],
      exclude: ["**/*.d.ts"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
