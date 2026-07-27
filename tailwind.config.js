/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F7F5F1",
        ink: "#1C1B1A",
        amber: "#C08A3E",
        line: "#E3DFD3",
        muted: "#8a8578",
        cardbg: "#FFFFFF",
        stamp: "#F1ECE0",
      },
      fontFamily: {
        display: ["Bitter", "serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
