/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'neon-blue': '#00d4ff',
        'neon-purple': '#b742ff',
        'neon-pink': '#ff2d95',
        'neon-green': '#00ff9f',
        'neon-red': '#ff3333',
        'dark-bg': '#0f0f23',
        'dark-card': '#1a1a3e',
        'dark-border': '#2a2a5e',
      },
    },
  },
  plugins: [],
};
