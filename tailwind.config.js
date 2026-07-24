/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Nova's surface system — layered translucent greys tuned for the
        // glassmorphic Arc-inspired chrome. `ink` is text, `surface` is chrome.
        ink: {
          DEFAULT: 'rgb(237 237 240)',
          soft: 'rgb(161 161 174)',
          faint: 'rgb(113 113 130)'
        },
        surface: {
          0: 'rgb(16 16 22)',
          1: 'rgb(24 24 32)',
          2: 'rgb(32 32 42)',
          3: 'rgb(44 44 56)'
        },
        nova: {
          DEFAULT: '#7c5cff',
          soft: '#9d84ff',
          glow: 'rgba(124, 92, 255, 0.35)'
        },
        accent: {
          mint: '#43e0b0',
          amber: '#ffb454',
          rose: '#ff6b8b'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px'
      },
      backdropBlur: {
        xs: '2px'
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        shimmer: 'shimmer 1.5s infinite'
      }
    }
  },
  plugins: []
}
