/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b0d12',
          900: '#10131a',
          800: '#161a24',
          700: '#1d222e',
          600: '#262c3a',
          500: '#394052',
          400: '#5b6479',
          300: '#8a93a8',
          200: '#c2c9d9',
          100: '#e6eaf4',
        },
        brand: {
          500: '#7c9cff',
          600: '#5f84ff',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Microsoft YaHei"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SFMono-Regular"', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
