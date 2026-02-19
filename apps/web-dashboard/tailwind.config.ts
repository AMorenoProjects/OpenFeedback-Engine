import type { Config } from "tailwindcss";
import sharedConfig from "@openfeedback/tailwind-config";

const config: Config = {
  presets: [sharedConfig as Config],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
