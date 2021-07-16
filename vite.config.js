/**
 * @type { import('vite').UserConfig }
 */
const config = {
  jsx: 'react',
  plugins: [],
  optimizeDeps: {
    exclude: ["oasis-engine"]
  },
}

export default config;
