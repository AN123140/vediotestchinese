import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  root: 'src/web',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
    },
  },
  plugins: [vue()],
  server: {
    port: 8080,
    strictPort: false,
    open: false,
    proxy: {
      // 开发环境代理 API 到 Python 后端
      '/api': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../../dist-web',
    emptyOutDir: true,
    // 不需要 Electron 相关的外部化
    rollupOptions: {
      external: [],
    },
  },
})
