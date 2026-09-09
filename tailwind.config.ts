import type { Config } from "tailwindcss";
import { nextui } from "@nextui-org/react";

// Reforma Dental brand kit tokens (RD Branding/ + claude.ai/design brand-kit project).
const rd = {
  greenPrimary: "#AED136",
  blueLight: "#73CFED",
  blueDark: "#4F646F",
  blackBrand: "#545758",
};

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: rd.greenPrimary,
          light: rd.blueLight,
          dark: rd.blueDark,
          ink: rd.blackBrand,
        },
      },
      fontFamily: {
        headline: ["Rockwell Nova", "Georgia", "serif"],
        subhead: ["Gibson", "Century Gothic", "sans-serif"],
      },
    },
  },
  darkMode: "class",
  plugins: [
    nextui({
      themes: {
        light: {
          colors: {
            primary: {
              DEFAULT: rd.greenPrimary,
              foreground: rd.blackBrand,
            },
            focus: rd.blueLight,
          },
        },
        dark: {
          colors: {
            primary: {
              DEFAULT: rd.greenPrimary,
              foreground: "#0b0f08",
            },
            focus: rd.blueLight,
          },
        },
      },
    }),
  ],
};

export default config;
