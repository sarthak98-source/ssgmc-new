/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
      },
      fontFamily: {
        sans:    ['Manrope', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
      },
      borderWidth: { 3: '3px' },
      animation: {
        'fade-up':    'fadeUp 0.4s ease both',
        'fade-in':    'fadeIn 0.5s ease both',
        'scale-in':   'scaleIn 0.3s ease both',
        'pulse-dot':  'pulseDot 1.5s ease-in-out infinite',
        'pulse-once': 'pulseOnce 0.6s ease both',
      },
      keyframes: {
        fadeUp:    { from:{ opacity:0, transform:'translateY(16px)' }, to:{ opacity:1, transform:'translateY(0)' } },
        fadeIn:    { from:{ opacity:0 }, to:{ opacity:1 } },
        scaleIn:   { from:{ opacity:0, transform:'scale(0.95)' }, to:{ opacity:1, transform:'scale(1)' } },
        pulseDot:  { '0%,100%':{ opacity:1 }, '50%':{ opacity:0.3 } },
        pulseOnce: { '0%':{ transform:'scale(1)' }, '50%':{ transform:'scale(1.02)' }, '100%':{ transform:'scale(1)' } },
      },
    },
  },
  plugins: [],
}
