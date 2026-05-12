/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{html,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        qc: {
          bg: '#0B0F14',
          panel: '#111821',
          panel2: '#162131',
          border: '#1F2A3A',
          text: '#E6EDF3',
          muted: '#8B98A8',
          accent: '#14B8A6',
          accent2: '#22D3EE'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace']
      },
      boxShadow: {
        'qc-glow': '0 0 24px rgba(20, 184, 166, 0.25)'
      }
    }
  },
  plugins: []
};
