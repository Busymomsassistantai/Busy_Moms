/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        instacart: {
          kale: '#003D29',
          cashew: '#FAF1E5',
          green: '#0AAD0A',
          orange: '#FF7009',
        },
      },
      spacing: {
        '5.5': '22px',
      },
    },
  },
  plugins: [],
};
