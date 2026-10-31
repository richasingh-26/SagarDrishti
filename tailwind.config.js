/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#060B10',
          deep: '#04070B',
          card: '#0D1620',
          cardSolid: '#0D1720',
          panel: '#0E1A26',
        },
        accent: {
          DEFAULT: '#5FE38A',
          glow: 'rgba(95, 227, 138, 0.25)',
          light: '#A8E6A3',
          dark: '#2DA854',
        },
        cyan: {
          accent: '#5BC0BE',
          dim: 'rgba(91, 192, 190, 0.18)',
        },
        gold: {
          accent: '#F59E0B',
          dim: 'rgba(245, 158, 11, 0.18)',
        },
        success: '#5FE38A',
        warning: '#F59E0B',
        danger: '#EF4444',
        muted: '#94A3B8',
        dim: '#64748B',
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        xs: '6px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '22px',
      },
      boxShadow: {
        glow: '0 0 24px rgba(95, 227, 138, 0.18)',
        'glow-accent': '0 0 30px rgba(95, 227, 138, 0.25)',
        'glow-cyan': '0 0 24px rgba(91, 192, 190, 0.2)',
        'glow-danger': '0 0 24px rgba(239, 68, 68, 0.2)',
        card: '0 16px 36px -10px rgba(0, 0, 0, 0.6)',
        'btn-accent': '0 4px 14px rgba(95, 227, 138, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 200ms ease-out',
        'spin-slow': 'spin 200s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
