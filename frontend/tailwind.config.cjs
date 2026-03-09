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
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-bottom': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-in-up': 'fade-in-up 0.4s ease-out',
        'fade-in-down': 'fade-in-down 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-in-bottom': 'slide-in-bottom 0.3s ease-out',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
      },
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(131, 110, 254, 0.08)',
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(131, 110, 254, 0.06)',
        'card-hover': '0 4px 16px rgba(131, 110, 254, 0.12), 0 2px 4px rgba(0,0,0,0.04)',
        'glow': '0 0 20px rgba(131, 110, 254, 0.25)',
        'modal': '0 20px 60px -12px rgba(28, 21, 40, 0.25), 0 0 0 1px rgba(131, 110, 254, 0.05)',
      },
      transitionDuration: {
        '250': '250ms',
      },
    },
  },
  plugins: [],
}
