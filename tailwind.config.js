/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        trade: {
          dark: '#0B0E14',
          card: '#121721',
          border: '#1E2638',
          accent: '#2563EB',
          green: '#10B981',
          red: '#EF4444',
          yellow: '#F59E0B',
          muted: '#64748B',
        }
      },
    },
  },
  plugins: [],
}
