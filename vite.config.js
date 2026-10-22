import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // 他のプロジェクト（5173番）とぶつからないよう専用のポートを使う
    port: 5180,
    strictPort: true,
    // スマホから同じWi-Fi経由で開けるようにする
    host: true,
  },
})
