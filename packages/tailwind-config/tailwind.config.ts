import type { Config } from "tailwindcss";

const config: Omit<Config, "content"> = {
  theme: {
    extend: {
      colors: {
        "of-primary": {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#b9dffd",
          300: "#7cc5fc",
          400: "#36a8f8",
          500: "#0c8ee9",
          600: "#0070c7",
          700: "#0059a1",
          800: "#054c85",
          900: "#0a406e",
        },
        "of-neutral": {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
        },
      },
      borderRadius: {
        "of": "0.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
