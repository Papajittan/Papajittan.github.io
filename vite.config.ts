import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const pages = readdirSync('.', { withFileTypes: true })
  .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist' && existsSync(`${entry.name}/index.html`))
  .map(entry => resolve(entry.name, 'index.html'))

export default defineConfig({
  base: '/',
  plugins: [tailwindcss()],
  server: {
    host: '127.0.0.1',
    fs: { allow: [process.cwd()], deny: ['**/.env*', '**/.git/**', '**/chapter.json', '**/*SOLUTION-GUIDE*'] },
  },
  build: {
    sourcemap: false,
    minify: true,
    cssMinify: true,
    manifest: false,
    rolldownOptions: { input: [resolve('index.html'), ...pages] },
  },
})
