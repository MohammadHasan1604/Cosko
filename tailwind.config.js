/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: '#002E86',
          foreground: '#ffffff',
          dark: '#00205D',
        },
        accent: {
          DEFAULT: '#009ADF',
          foreground: '#ffffff',
          dark: '#007EB6',
        },
        action: {
          DEFAULT: '#3279F6',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: '#F5F5F5',
          foreground: '#64748b',
        },
        card: {
          DEFAULT: '#ffffff',
          foreground: '#000000',
        },
        border: '#DDDDDD',
        input: '#DDDDDD',
        ring: '#009ADF',
        positive: '#35CE8D',
        warning: '#FEC601',
        danger: '#FF0A21',
        info: '#009ADF',
        // Official COSKO PDF Extended Palette
        'air-force-blue': '#002E86',
        'blue-cola': '#009ADF',
        'mountain-meadow': '#35CE8D',
        'golden-poppy': '#FEC601',
        'rich-lavender': '#A06CD5',
        'sheen-green': '#98CE00',
        'flesh': '#FFEAD0',
        'alert-red': '#FF0A21',
        'action-blue': '#3279F6',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
      },
      fontFamily: {
        sans: ['"General Sans"', 'var(--font-plus-jakarta-sans)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)',
        modal: '0 20px 60px -10px rgba(0,0,0,0.18), 0 8px 20px -4px rgba(0,0,0,0.08)',
        sidebar: '2px 0 8px 0 rgba(0,0,0,0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease forwards',
        'slide-up': 'slideUp 200ms ease forwards',
        'pulse-highlight': 'pulseHighlight 600ms ease forwards',
        'skeleton-wave': 'skeletonWave 1.5s infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};