import { defineConfig } from 'vite';

// IIFE bundle for embed via <script src="...">.
// Outputs single self-contained kairo.js with CSS inlined.
export default defineConfig({
  // El widget NO usa PostCSS — todo el CSS esta inline en src/styles.ts.
  // Sin esto, Vite hace autodiscovery y carga el postcss.config.mjs del
  // root del repo (que requiere @tailwindcss/postcss del proyecto kairo).
  css: {
    postcss: {},
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    target: 'es2020',
    minify: 'esbuild',
    lib: {
      entry: 'src/index.ts',
      formats: ['iife'],
      name: 'KairoWidget',
      fileName: () => 'kairo.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        // No external dependencies — fully self-contained bundle.
        extend: true,
      },
    },
  },
});
