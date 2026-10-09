import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Requests to /api are forwarded to lexico-api with the prefix removed, so the
// browser only talks to its own origin. The API's own paths (/decks, /words/…)
// would clash with this app's pages, hence the prefix.
const apiProxy = {
  '/api': {
    target: 'http://localhost:3000',
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
})
