/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#eceeeb',
          2: '#e0e3e0',
          card: '#f6f7f4',
          dark: '#0a0f1d',
          dark2: '#101726',
          darkCard: '#131e33',
        },
        ink: {
          DEFAULT: '#16181d',
          2: '#3d4048',
          muted: '#626875',
        },
        blueprint: {
          DEFAULT: '#1d49a7',
          deep: '#163a86',
          tint: '#dce3f1',
          on: '#ffffff',
          on2: '#cdd9f3',
        },
        motoRed: {
          DEFAULT: '#c62f1f',
        }
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        sans: ['Atkinson Hyperlegible', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}

