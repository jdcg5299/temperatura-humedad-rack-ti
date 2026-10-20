/** @type {import('tailwindcss').Config} */
export default {
  // Modo oscuro con clase: el toggle la pone en <html>. El valor inicial
  // respeta prefers-color-scheme (ver App.tsx).
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Fuente empaquetada con npm (@fontsource): sin CDN, sin red al abrir.
      fontFamily: {
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
