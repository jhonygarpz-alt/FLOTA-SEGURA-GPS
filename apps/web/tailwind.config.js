/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Verde petróleo institucional
        brand: { 50: '#E8F3F4', 100: '#CDE5E8', 200: '#9DCBD1', 300: '#62A9B2', 400: '#2E8592', 500: '#11697A', 600: '#0B5966', 700: '#0B4F59', 800: '#0A3D45', 900: '#082E34' },
        // Cian complementario
        accent: { 400: '#22D3EE', 500: '#06B6D4', 600: '#0891B2' },
        pearl: { 50: '#FAFAFB', 100: '#F4F5F7', 200: '#E9EBEF', 300: '#D9DCE2' },
        ink: { 900: '#0B1215', 800: '#121B1F', 700: '#1A252A', 600: '#253338' },
        state: { moving: '#16A34A', idle: '#CA8A04', parked: '#8B949E', alert: '#DC2626', offline: '#3F4A50' },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      borderRadius: { '4xl': '2rem', icon: '22%' },
      boxShadow: {
        soft: '0 1px 2px rgba(16,24,40,.04), 0 4px 16px rgba(16,24,40,.06)',
        float: '0 8px 32px rgba(16,24,40,.14)',
        icon: '0 2px 6px rgba(16,24,40,.18), inset 0 1px 0 rgba(255,255,255,.25)',
      },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        pulse2: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.45 } },
      },
      animation: { 'fade-up': 'fade-up .28s ease-out both', pulse2: 'pulse2 1.6s ease-in-out infinite' },
    },
  },
  plugins: [],
};
