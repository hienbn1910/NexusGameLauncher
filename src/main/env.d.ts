// Biến môi trường electron-vite chèn vào main lúc build (đọc từ file .env, không đưa lên git)
interface ImportMetaEnv {
  // Key SteamGridDB mặc định cho người dùng chưa nhập key riêng
  readonly MAIN_VITE_SGDB_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
