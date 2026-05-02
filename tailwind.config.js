/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        soft: '0 22px 50px rgba(15, 23, 42, 0.10)',
      },
    },
  },
  plugins: [],
}
