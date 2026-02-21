import type { Config } from "tailwindcss";
import sharedConfig from "@openfeedback/tailwind-config";

const config: Config = {
  presets: [sharedConfig as Config],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "of-bg-base": "var(--of-bg-base)",
        "of-bg-card": "var(--of-bg-card)",
        "of-border-base": "var(--of-border-base)",
        "of-text-heading": "var(--of-text-heading)",
        "of-text-body": "var(--of-text-body)",
      }
    },
  },
  plugins: [],
};

export default config;
