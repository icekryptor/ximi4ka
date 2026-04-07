import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#836efe",
        "primary-dark": "#6703ff",
        "primary-gradient-start": "rgba(141,103,255,1)",
        "primary-gradient-end": "rgba(200,86,255,1)",
        "text-dark": "#1c1528",
        "text-secondary": "#524667",
        border: "#e8e5ef",
        "bg-light": "#eeebf3",
      },
      borderRadius: {
        xl: "20px",
        "2xl": "30px",
        "3xl": "40px",
        "4xl": "55px",
      },
      fontFamily: {
        sans: ["Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
