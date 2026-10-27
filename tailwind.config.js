/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0A1628',
          deep: '#070F1E',
          panel: 'rgba(26, 42, 74, 0.65)',
        },
        cyan: {
          accent: '#00D4FF',
          dim: 'rgba(0, 212, 255, 0.18)',
        },
        gold: {
          accent: '#FFD700',
          dim: 'rgba(255, 215, 0, 0.18)',
        },
        success: '#00FF88',
        warning: '#FFA500',
        danger: '#FF4444',
        muted: '#8899AA',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(0, 212, 255, 0.15)',
        'glow-gold': '0 0 20px rgba(255, 215, 0, 0.15)',
        'glow-danger': '0 0 20px rgba(255, 68, 68, 0.2)',
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
