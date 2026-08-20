/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        background: '#0B0D10',
        'bg-elevated': '#15181D',
        'bg-soft': '#1A1E24',
        'bg-card': '#191D23',
        text: '#F5F3EF',
        'text-dim': '#C9C5BF',
        'text-muted': '#8B8781',
        gold: '#D4A24C',
        'gold-soft': '#EBCB8E',
        rose: '#E58C9E',
        'rose-soft': '#F2BFC8',
        line: 'rgba(245, 243, 239, 0.08)',
        'line-strong': 'rgba(245, 243, 239, 0.16)',
      },
      backgroundImage: {
        'gradient-flow': 'linear-gradient(120deg, #D4A24C 0%, #E58C9E 100%)',
      },
      boxShadow: {
        'soft': '0 24px 60px -24px rgba(0, 0, 0, 0.65)',
        'card': '0 16px 40px -20px rgba(0, 0, 0, 0.55)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        scrollcue: {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '1' },
        },
        'pulse-ring': {
          '0%': { opacity: '0.9' },
          '100%': { opacity: '0.15' },
        },
      },
      animation: {
        float: 'float 5s ease-in-out infinite',
        scrollcue: 'scrollcue 1.8s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 3s ease-out infinite',
      }
    },
  },
  plugins: [],
}
