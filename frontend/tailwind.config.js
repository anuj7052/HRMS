/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Mobile app palette: palette.primary = '#1A3C6E'
        primary: {
          50:  '#EEF3FB',
          100: '#D5E3F5',
          200: '#ACC7EB',
          300: '#82ABE0',
          400: '#598FD5',
          500: '#2E5A9E',
          600: '#1A3C6E',   // palette.primary — main brand navy
          700: '#0F2747',   // palette.primaryDark
          800: '#0A1B33',
          900: '#060F1E',
        },
        // palette.present = '#16A34A'
        success: {
          50:  '#F0FDF4',
          100: '#DCFCE7',
          400: '#4ADE80',
          500: '#16A34A',
          600: '#15803D',
        },
        // palette.absent = '#DC2626'
        danger: {
          50:  '#FEF2F2',
          100: '#FEE2E2',
          400: '#F87171',
          500: '#DC2626',
          600: '#B91C1C',
        },
        // palette.accent = '#F59E0B'
        accent: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #1A3C6E 0%, #0F2747 100%)',
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'skeleton': 'skeleton 1.5s ease-in-out infinite',
        'pulse-ring': 'pulseRing 1.5s ease-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideIn:   { '0%': { transform: 'translateY(-8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        skeleton:  { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        pulseRing: { '0%': { transform: 'scale(1)', opacity: '0.8' }, '100%': { transform: 'scale(1.5)', opacity: '0' } },
      },
    },
  },
  plugins: [],
};
