/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        teal: {
          950: '#061718',
          900: '#0d2a2c',
          850: '#103437',
          800: '#143d40',
          700: '#194c50',
          600: '#226065',
        },
        gold: {
          300: '#fde096',
          400: '#fad982',
          500: '#f5c65d',
          600: '#e5ad3a',
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
        }
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-subtle': 'pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'border-beam': 'borderBeam 8s linear infinite',
      },
      keyframes: {
        shimmer: {
          from: { backgroundPosition: '0 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        borderBeam: {
          '100%': { 'offset-distance': '100%' },
        },
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        'elevated': '0 4px 6px -1px rgba(13, 42, 44, 0.05), 0 2px 4px -2px rgba(13, 42, 44, 0.05)',
        'glow-teal': '0 0 20px -3px rgba(13, 42, 44, 0.35)',
        'glow-gold': '0 0 20px -3px rgba(250, 217, 130, 0.4)',
      }
    },
  },
  plugins: [],
};
