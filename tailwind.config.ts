import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: { colors: { wine: "#7b253c", ink: "#242526", paper: "#faf9f6" } },
  },
  plugins: [],
} satisfies Config;
