// Placeholder build for Fase 3 scaffolding.
// Reemplazado por Vite IIFE bundle cuando arranquemos Fase 3.5.
import { mkdirSync, copyFileSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
copyFileSync('index.html', 'dist/index.html');
console.log('[widget] placeholder build done -> dist/index.html');
