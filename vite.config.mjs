import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [
        vue()
    ],
    build: {
        outDir: 'dist',
        assetsDir: '', // 設定為空字串，資源將直接輸出到 dist 根目錄
        rollupOptions: {
            input: {
                popup: 'index.html',
            },
            output: {
                // 自定義資源的輸出文件名格式
                entryFileNames: '[name]_build.js',
                chunkFileNames: '[name]_build.js',
                assetFileNames: '[name]_build.[ext]'
            }
        }
    }
})