import { existsSync } from 'fs'
import { join } from 'path'
import { GAME_CATALOG } from './game-catalog'

// Ảnh dọc đóng gói sẵn cho danh mục game phổ biến: resources/catalog/<id>.webp (400x600).
// Có sẵn trong app để hộp thoại "Thêm game phổ biến" luôn có ảnh, kể cả khi mạng chặn Steam.
// Bản đóng gói: resources/ nằm ngoài asar (asarUnpack trong electron-builder.yml)
const CATALOG_ART_DIR = join(__dirname, '../../resources/catalog').replace(
  'app.asar',
  'app.asar.unpacked'
)

// Đường dẫn ảnh của game trong danh mục; null nếu mã không hợp lệ hoặc chưa có ảnh
export function catalogArtPath(id: string): string | null {
  if (!GAME_CATALOG.some((e) => e.id === id)) return null
  const path = join(CATALOG_ART_DIR, `${id}.webp`)
  return existsSync(path) ? path : null
}
