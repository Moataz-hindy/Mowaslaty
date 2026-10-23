import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cp, readdir } from 'node:fs/promises';
import path from 'node:path';

function nativePublicAssets() {
  return {
    name: 'native-public-assets-without-downloads',
    apply: 'build',
    async closeBundle() {
      if (process.env.MOWASLATY_NATIVE_BUILD !== '1') return;
      const root = path.resolve('public');
      const copyTree = async (from, to) => {
        for (const entry of await readdir(from, { withFileTypes: true })) {
          if (from === root && entry.name === 'downloads') continue;
          const source = path.join(from, entry.name);
          const target = path.join(to, entry.name);
          if (entry.isDirectory()) {
            await fs.mkdir(target, { recursive: true });
            await copyTree(source, target);
          } else await cp(source, target);
        }
      };
      const fs = await import('node:fs/promises');
      await copyTree(root, path.resolve('dist-android'));
    }
  };
}

export default defineConfig({
  plugins: [react(), nativePublicAssets()],
  define: {
    __MOWASLATY_NATIVE__: JSON.stringify(process.env.MOWASLATY_NATIVE_BUILD === '1')
  },
  build: process.env.MOWASLATY_NATIVE_BUILD === '1'
    ? { outDir: 'dist-android', emptyOutDir: true, copyPublicDir: false }
    : { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 3000,
    open: false
  }
});
