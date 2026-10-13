import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'app-bg':      '#09090F',
        'sidebar':     '#0E0E17',
        'elevated':    '#141420',
        'border-app':  '#262638',
        'primary':     '#F4F4F7',
        'secondary':   '#9999AD',
        'accent':      '#8B7CFF',
        'accent-h':    '#A69BFF',
        'success':     '#42D6A4',
        'warning':     '#F2B86B',
        'error':       '#FF6B6B',
      },
    },
  },
  plugins: [],
};

export default config;
