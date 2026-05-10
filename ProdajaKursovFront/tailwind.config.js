/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // включаем переключение по классу .dark
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['SF Pro Display', 'ui-sans-serif', 'system-ui', 'Apple Color Emoji'],
      },
      colors: {
        ink: '#e5e7eb',
        muted: '#9ca3af',
        osnova: {
          blue: '#266479', // Top Left (Teal/Blue)
          yellow: '#f2b749', // Top Right (Golden Yellow)
          pink: '#d63d6b', // Bottom Left (Magenta/Pink)
          green: '#6da04b', // Bottom Right (Olive/Green)
        }
      },
      boxShadow: {
        glass: '0 10px 30px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.08)',
        neon: '0 0 40px rgba(38,100,121,.25)',
      },
      backgroundImage: {
        mesh: `
          radial-gradient(1200px 600px at 10% -10%, rgba(38, 100, 121, 0.25), transparent 60%),
          radial-gradient(800px 400px at 90% 10%, rgba(242, 183, 73, 0.2), transparent 60%),
          radial-gradient(1000px 500px at 50% 120%, rgba(214, 61, 107, 0.2), transparent 60%)
        `,
      },
      animation: {
        float: 'float 12s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
}
