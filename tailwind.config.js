/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'lyzr': {
          'primary': '#51A3FE',
          'secondary': '#8561C8',
          'success': '#4BD37B',
          'warning': '#FEC660',
          'error': '#F45B69',
          'info': '#31B6FD',
          'background': '#F6FAFF',
          'surface': '#FFFFFF',
          'text': '#23272F'
        }
      }
    },
  },
  plugins: [],
}