import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Dev only. The app calls /api/espn-scores as a relative URL, which in
  // production is a Vercel function. Vite does not run those, so without this
  // the dev server answers with index.html and the ESPN fetch fails on a JSON
  // parse rather than anything meaningful. Proxying to the deployed site lets
  // local dev exercise the real scoring path. Has no effect on the build.
  server: {
    proxy: {
      '/api': {
        target: 'https://www.19pool.com',
        changeOrigin: true,
      },
    },
  },
});
