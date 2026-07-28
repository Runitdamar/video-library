/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#EEEBE4",
        ink: "#1A1A18",
        amber: "#C08A3E",
        red: "#C7392B",
        line: "#E3DFD3",
        muted: "#8C8778",
        cardbg: "#FFFFFF",
        stamp: "#F1ECE0",
      },
      fontFamily: {
        display: ["'Plus Jakarta Sans'", "sans-serif"],
        sans: ["'Plus Jakarta Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
