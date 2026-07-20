import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          900: "#0a0f16",
          800: "#111b27",
          700: "#172638",
        },
        electric: {
          300: "#84d7ff",
          400: "#4cb5ff",
          500: "#2196f3",
        },
      },
      boxShadow: {
        glass: "0 24px 50px rgba(3, 8, 20, 0.45)",
        glow: "0 0 0 1px rgba(132, 215, 255, 0.4), 0 16px 32px rgba(33, 150, 243, 0.25)",
      },
      borderRadius: {
        xl2: "1.2rem",
      },
      transitionDuration: {
        180: "180ms",
      },
    },
  },
  plugins: [],
};

export default config;


