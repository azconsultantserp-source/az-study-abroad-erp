import { describe, it, expect, vi } from "vitest";

// The root layout pulls in a web font and a client theme provider at module
// load; stub both so we can assert on the exported metadata in isolation.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter", className: "font-inter" }),
}));

vi.mock("@/components/theme/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  themeInitScript: "",
}));

import { metadata } from "@/app/layout";

describe("root layout metadata", () => {
  it("uses the AZ logo as the browser tab favicon", () => {
    expect(metadata.icons).toMatchObject({
      icon: "/logo.png",
      shortcut: "/logo.png",
      apple: "/logo.png",
    });
  });

  it("keeps the internal system out of search indexes", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it("sets the branded title template", () => {
    expect(metadata.title).toMatchObject({
      default: expect.stringContaining("AZ Consultants"),
      template: expect.stringContaining("%s"),
    });
  });
});
