/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Inter везде — display/stats оставлены как алиасы, чтобы не править классы по всему проекту
        display: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        stats: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        body: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
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
