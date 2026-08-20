/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        title: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        accent: '#e99825',
      }
    },
  },
  plugins: [],
}
