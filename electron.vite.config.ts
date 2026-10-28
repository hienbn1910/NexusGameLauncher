import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // resedit / pe-library chỉ có bản ESM nên bundle thẳng vào main thay vì require lúc chạy
    plugins: [externalizeDepsPlugin({ exclude: ['resedit', 'pe-library'] })]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
