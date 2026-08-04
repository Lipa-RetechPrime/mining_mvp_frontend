import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        portal: {
          navy: "#1E293B",
          purple: "#8B5CF6",
          "purple-soft": "#EDE9FE",
          "purple-text": "#6D28D9",
          border: "#DDDDDD",
          muted: "#B0B0B0",
          surface: "#FFFFFF",
        },
      },
      borderRadius: {
        card: "8px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.06)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
