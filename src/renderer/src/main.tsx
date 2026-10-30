// Font đóng gói kèm app (đều có bộ chữ tiếng Việt), không phụ thuộc mạng
import '@fontsource/chakra-petch/400.css'
import '@fontsource/chakra-petch/500.css'
import '@fontsource/chakra-petch/600.css'
import '@fontsource/chakra-petch/700.css'
import '@fontsource-variable/exo-2/wght.css'
import '@fontsource-variable/exo-2/wght-italic.css'
import '@fontsource-variable/jetbrains-mono'
// Orbitron không có dấu tiếng Việt: chỉ dùng cho số và logo
import '@fontsource-variable/orbitron'
import './assets/main.css'
import './assets/themes.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme, cachedTheme, currentTheme } from './utils/theme'

// Áp dụng theme đã lưu trước khi vẽ để không bị nháy giao diện khác,
// sau đó đồng bộ với cài đặt trong cơ sở dữ liệu (nguồn chính)
applyTheme(cachedTheme())
window.electronAPI.app.getAppearance().then(({ theme }) => {
  if (theme !== currentTheme()) applyTheme(theme)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
