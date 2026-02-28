/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f8efe3",
          100: "#f2e3cf",
          200: "#e7cfaf",
          300: "#d8b27f",
          400: "#c99654",
          500: "#b8742a",
          600: "#a06724",
          700: "#8a5a16",
          800: "#6e4715",
          900: "#54350f",
        },
      },
    },
  },
  plugins: [],
};
