import type { Config } from "tailwindcss";

/** Build a Tailwind color that reads a CSS variable and supports /opacity. */
const withVar = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        az: {
          teal: "#0B5E57",
          "teal-dark": "#084840",
          "teal-light": "#0E7269",
          gold: "#E8B923",
          "gold-dark": "#C99A15",
          "gold-light": "#F5D04A",
        },
        // Semantic, theme-aware tokens (light + dark via CSS variables).
        app: withVar("--c-app"),
        surface: withVar("--c-surface"),
        heading: withVar("--c-heading"),
        content: {
          DEFAULT: withVar("--c-content"),
          muted: withVar("--c-muted"),
          faint: withVar("--c-faint"),
        },
        line: {
          DEFAULT: withVar("--c-line"),
          strong: withVar("--c-line-strong"),
        },
        brand: withVar("--c-brand"),
        accent: withVar("--c-accent"),
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        soft: "var(--shadow-sm)",
        card: "var(--shadow-md)",
        elevated: "var(--shadow-lg)",
        float: "var(--shadow-xl)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) forwards",
      },
    },
  },
  plugins: [],
};

export default config;
