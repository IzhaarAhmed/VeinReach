/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Figtree for UI/headings, Noto Sans as the humanist body fallback
        // (design engine: medical, clean, accessible, trustworthy).
        sans: ['Figtree', 'Noto Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand = rose-crimson — the blood / emotional signal. Refined from the
        // old flat red to a richer, more premium rose scale.
        brand: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        // Accent = teal — calm, clinical trust (pairs with the blood red).
        accent: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        // Ink = the slate canvas + surfaces the whole app sits on.
        ink: {
          950: '#070b16',
          900: '#0b1120',
          800: '#111a2e',
          700: '#1b2740',
          600: '#26344f',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.4), 0 12px 32px -12px rgba(0,0,0,0.55)',
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 40px -24px rgba(0,0,0,0.7)',
        glow: '0 10px 40px -12px rgba(244,63,94,0.45)',
        'glow-teal': '0 10px 40px -12px rgba(20,184,166,0.4)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease both',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
