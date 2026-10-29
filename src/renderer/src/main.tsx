// Roboto đóng gói kèm app (có bộ chữ tiếng Việt), không phụ thuộc mạng
import '@fontsource-variable/roboto'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
