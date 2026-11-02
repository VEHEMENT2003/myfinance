/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./assets/js/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        'bg-primary':   '#080F1C',
        'bg-secondary': '#0D1726',
        'bg-card':      '#111D2E',
        'bg-elevated':  '#17263A',
        'accent':       '#00D6A0',
        'accent-hover': '#00B98A',
        'income':       '#00C98D',
        'expense':      '#FF555F',
        'info':         '#369CFF',
        'accent-2':     '#8058F5',
        'txt-primary':  '#F4F7FB',
        'txt-secondary':'#91A0B5',
        'brd':          '#24364D',
      },
      borderRadius: {
        'card': '14px',
        'xl2':  '20px',
      },
      boxShadow: {
        'card': '0 4px 24px rgba(0,0,0,0.30)',
        'glow': '0 0 24px rgba(0,214,160,0.25)',
      },
    },
  },
  plugins: [],
};