import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#FFFBF3",
        lilac: "#E8E1FF",
        lilacDeep: "#B8A6F0",
        peach: "#FFE0D2",
        peachDeep: "#FF9F7E",
        mint: "#D6F5E3",
        mintDeep: "#7DD9A8",
        sky: "#D8ECFF",
        skyDeep: "#7FB8F0",
        ink: "#4A4458",
        inkSoft: "#8A8398",
      },
      fontFamily: {
        rounded: ['"Baloo 2"', '"Noto Sans TC"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        soft: "0 8px 30px rgba(120, 110, 160, 0.12)",
        softer: "0 4px 18px rgba(120, 110, 160, 0.10)",
        pop: "0 10px 0 rgba(0,0,0,0.06)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        float: "float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
