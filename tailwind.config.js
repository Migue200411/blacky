/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#0b3d2e',
          dark: '#072620',
          light: '#125a45'
        },
        chip: {
          red: '#c2201f',
          gold: '#d4a83c',
          blue: '#1e5fa5',
          green: '#178a4a',
          black: '#1a1a1a'
        },
        card: {
          bg: '#f5f2ea',
          red: '#c2201f',
          black: '#111111'
        }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'ui-serif', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 4px 14px rgba(0,0,0,0.55)',
        chip: '0 3px 8px rgba(0,0,0,0.65)'
      },
      keyframes: {
        dealIn: {
          '0%': { transform: 'translateY(-40px) rotate(-6deg)', opacity: '0' },
          '100%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' }
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' }
        }
      },
      animation: {
        dealIn: 'dealIn 260ms ease-out',
        fadeIn: 'fadeIn 200ms ease-out'
      }
    }
  },
  plugins: []
}
