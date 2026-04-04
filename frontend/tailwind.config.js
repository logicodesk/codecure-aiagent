/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        brand: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          900: '#0c4a6e',
        },
        surface: {
          DEFAULT: '#080C14',
          card:    '#0E1420',
          border:  'rgba(255,255,255,0.08)',
        },
        toxic:  { DEFAULT: '#ef4444', muted: 'rgba(239,68,68,0.15)' },
        safe:   { DEFAULT: '#22c55e', muted: 'rgba(34,197,94,0.15)'  },
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow':   'spin 3s linear infinite',
        'float':       'float 4s ease-in-out infinite',
        'glow-pulse':  'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-6px)' },
        },
        glowPulse: {
          '0%,100%': { boxShadow: '0 0 12px rgba(14,165,233,0.3)' },
          '50%':     { boxShadow: '0 0 24px rgba(14,165,233,0.6)' },
        },
      },
      backdropBlur: { xs: '2px' },
      boxShadow: {
        'brand-sm': '0 2px 12px rgba(14,165,233,0.25)',
        'brand-md': '0 4px 24px rgba(14,165,233,0.35)',
        'toxic-sm': '0 2px 12px rgba(239,68,68,0.25)',
        'safe-sm':  '0 2px 12px rgba(34,197,94,0.25)',
      },
    },
  },
  plugins: [],
}
