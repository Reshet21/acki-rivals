/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'an-gold': '#FFD700',
        'an-yellow': '#FFC107',
        'an-orange': '#FF9800',
        'an-red': '#FF3D00',
        'an-green': '#00E676',
        'an-dark': '#0A0A0A',
        'an-card': '#1A1A1A',
        'an-surface': '#121212',
        'an-border': '#2A2A2A',
      },
    },
  },
  plugins: [],
};
