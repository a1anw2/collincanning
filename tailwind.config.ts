import type { Config } from 'tailwindcss';

/** Palette from Adam Wathan's Slack clone (tailwindcss@0.3 CodePen JOQWVa). */
export default {
  content: ['./src/frontend/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        slack: {
          'indigo-darkest': '#1F1D37',
          'indigo-darker': '#312E56',
          'indigo-lighter': '#453E73',
          'purple-lighter': '#D6D6EB',
          'teal-dark': '#116263',
          grey: '#9B9B9B',
          'grey-light': '#D2D2D2',
          'grey-lighter': '#F5F5F5',
          'grey-dark': '#7B7B7B',
          'grey-darkest': '#2D2D2D',
          'blue-lightest': '#E3F2FD',
          blue: '#2D9CDB',
          green: '#68D391',
          // Legacy aliases (admin + shared UI)
          aubergine: '#312E56',
          'aubergine-dark': '#1F1D37',
          hover: '#1F1D37',
          active: '#2D9CDB',
          text: '#D1D2D3',
          'text-dim': '#868686',
          surface: '#1A1D21',
          'surface-raised': '#222529',
          border: '#383B3D',
          mention: '#2D9CDB',
        },
      },
      fontFamily: {
        sans: ['Lato', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        'typing-bounce': 'typing-bounce 1.2s ease-in-out infinite',
      },
      keyframes: {
        'typing-bounce': {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
