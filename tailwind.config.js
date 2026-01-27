/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'petrol-yellow': '#FDB913',
        'petrol-green': '#39FF14',
        'petrol-black': '#0A0A0A',
        'petrol-gray': '#6B7280',
      },
    },
  },
  plugins: [],
}
