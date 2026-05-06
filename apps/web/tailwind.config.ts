import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brown: {
          50:  "#fdf6ee",
          100: "#f5e8c8",
          200: "#e8cc96",
          300: "#d4a85a",
          400: "#c08830",
          500: "#a06820",
          600: "#6B3A1F",
          700: "#4A2512",
          800: "#3D1C08",
          900: "#2A1205",
        },
        gold: {
          300: "#F8E07A",
          400: "#F5D050",
          500: "#F0C040",
          600: "#D4A020",
          700: "#B08010",
        },
        cream: {
          50:  "#FFFEF8",
          100: "#FDF8EC",
          200: "#F5E8C8",
          300: "#EDD8A8",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)"],
        display: ["var(--font-playfair)"],
      },
      backgroundImage: {
        "coffee-texture": "url('/coffee-bg.jpg')",
      },
      keyframes: {
        marquee: {
          "0%":   { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        marquee:  "marquee 30s linear infinite",
        "fade-up": "fade-up 0.6s ease forwards",
      },
    },
  },
  plugins: [],
};

export default config;
