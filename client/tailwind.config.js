/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Palette mirrors client/src/theme.ts so tokens used in code and
      // utilities used in markup stay in sync.
      colors: {
        primary: '#0ea5e6',
        accent: '#f59e0b',
        surface: '#ffffff',
        'surface-alt': '#f1f5f9',
        border: '#e2e8f0',
      },
      fontFamily: {
        body: ['ui-sans', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
