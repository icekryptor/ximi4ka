/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#836efe',
          600: '#6703ff',
          700: '#5b21b6',
          800: '#4c1d95',
          900: '#1c1528',
        },
        brand: {
          border: '#e8e5ef',
          surface: '#f8f7fa',
          text: '#1c1528',
          'text-secondary': '#524667',
        }
      },
      borderRadius: {
        'brand': '40px',
        'brand-lg': '55px',
      },
      fontFamily: {
        sans: ['Inter', 'Arial', 'Helvetica', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
