/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Overrides Tailwind's stock blue/green scales with ramps derived
        // from the exact colors in the Reneal logo (#094fa4 blue, #3ab54a
        // green) — every existing bg-blue-*/text-green-*/etc. class across
        // the app picks these up automatically, no component changes needed.
        blue: {
          50: '#f0f4fa', 100: '#dde7f3', 200: '#b2cef0', 300: '#6eacf7', 400: '#2a85f3',
          500: '#0c66d5', 600: '#0a54ae', 700: '#08448c', 800: '#063874', 900: '#052a57', 950: '#031c3a',
        },
        green: {
          50: '#f2f8f3', 100: '#e2efe3', 200: '#bfe3c4', 300: '#8bda95', 400: '#55c964',
          500: '#36aa45', 600: '#2d8b39', 700: '#24702e', 800: '#1e5d26', 900: '#16461c', 950: '#0f2e13',
        },
      },
    },
  },
  plugins: [],
}
