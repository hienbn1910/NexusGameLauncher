import { randomUUID } from 'crypto'
import { mkdirSync } from 'fs'
import { rm, writeFile } from 'fs/promises'
import { extname, join } from 'path'
import { pathToFileURL } from 'url'
import { app, nativeImage, net } from 'electron'
import { getDb } from '../database'

// Hồ sơ người dùng (tên, ảnh đại diện).
// Giao diện chỉ làm việc qua các hàm ở đây, nên sau này thêm đăng nhập / đăng ký thì chỉ cần
// đổi phần lưu trữ (account_type 'remote', đồng bộ với máy chủ), giao diện gần như giữ nguyên.
// id tạo sẵn từ bây giờ để dữ liệu trên máy (giờ chơi, ghi chú...) gắn được vào tài khoản sau này.

export type AvatarType = 'initials' | 'preset' | 'image'

export interface Profile {
  id: string
  displayName: string
  avatar: { type: AvatarType; value: string | null } // preset: mã avatar, image: game-media://avatar/...
  accountType: 'local' | 'remote'
  onboarded: boolean
  createdAt: string
}

// image: path = ảnh mới chọn từ máy; không có path = giữ ảnh hiện tại
export type AvatarInput =
  { type: 'initials' } | { type: 'preset'; value: string } | { type: 'image'; path?: string }

export interface ProfileInput {
  displayName: string
  avatar: AvatarInput
}

interface ProfileRow {
  id: string
  display_name: string
  avatar_type: AvatarType
  avatar_value: string | null
  account_type: 'local' | 'remote'
  onboarded: number
  created_at: string
}

export const DEFAULT_NAME = 'Player'
export const MAX_NAME_LENGTH = 32
export const AVATAR_EXTENSIONS = ['png', 'jpg', 'jpeg', 'bmp']
const AVATAR_SIZE = 256
const PRESET_ID = /^[a-z0-9-]{1,32}$/
const SAFE_FILE_NAME = /^[\w-]+\.png$/

function avatarsDir(): string {
  const dir = join(app.getPath('userData'), 'avatars')
  mkdirSync(dir, { recursive: true })
  return dir
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatar: {
      type: row.avatar_type,
      value:
        row.avatar_type === 'image' && row.avatar_value
          ? `game-media://avatar/${row.avatar_value}`
          : row.avatar_value
    },
    accountType: row.account_type,
    onboarded: row.onboarded === 1,
    createdAt: row.created_at
  }
}

function readRow(): ProfileRow | undefined {
  return getDb().prepare('SELECT * FROM profile ORDER BY created_at LIMIT 1').get() as
    ProfileRow | undefined
}

// Lần đầu mở app => tạo hồ sơ mặc định "Player"
export function getProfile(): Profile {
  let row = readRow()
  if (!row) {
    getDb()
      .prepare('INSERT INTO profile (id, display_name) VALUES (?, ?)')
      .run(randomUUID(), DEFAULT_NAME)
    row = readRow()!
  }
  return toProfile(row)
}

export function cleanName(name: unknown): string {
  const value = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim() : ''
  return value.slice(0, MAX_NAME_LENGTH) || DEFAULT_NAME
}

// Cắt ảnh thành hình vuông ở giữa rồi thu nhỏ
function squareAvatar(imagePath: string): Electron.NativeImage {
  const ext = extname(imagePath).slice(1).toLowerCase()
  if (!AVATAR_EXTENSIONS.includes(ext)) throw new Error('Định dạng ảnh không được hỗ trợ')
  const image = nativeImage.createFromPath(imagePath)
  if (image.isEmpty()) throw new Error('Không đọc được file ảnh')
  const { width, height } = image.getSize()
  const side = Math.min(width, height)
  return image
    .crop({
      x: Math.floor((width - side) / 2),
      y: Math.floor((height - side) / 2),
      width: side,
      height: side
    })
    .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE, quality: 'best' })
}

// Ảnh xem trước (data URL) trước khi bấm Lưu
export function previewAvatar(imagePath: string): string | null {
  try {
    return squareAvatar(imagePath).toDataURL()
  } catch {
    return null
  }
}

async function removeAvatarFile(fileName: string | null): Promise<void> {
  if (fileName && SAFE_FILE_NAME.test(fileName)) {
    await rm(join(avatarsDir(), fileName), { force: true })
  }
}

export async function saveProfile(input: ProfileInput): Promise<Profile> {
  getProfile() // Đảm bảo đã có hồ sơ
  const current = readRow()!
  const avatar = input?.avatar
  let type: AvatarType = 'initials'
  let value: string | null = null

  if (avatar?.type === 'preset' && PRESET_ID.test(String(avatar.value))) {
    type = 'preset'
    value = avatar.value
  } else if (avatar?.type === 'image') {
    if (avatar.path) {
      // Tên file đổi mỗi lần để giao diện không dùng ảnh cũ trong cache
      value = `${current.id}-${Date.now()}.png`
      await writeFile(join(avatarsDir(), value), squareAvatar(avatar.path).toPNG())
      type = 'image'
    } else if (current.avatar_type === 'image' && current.avatar_value) {
      type = 'image'
      value = current.avatar_value
    }
  }

  // Ảnh cũ không còn dùng => xoá
  if (current.avatar_type === 'image' && current.avatar_value !== value) {
    await removeAvatarFile(current.avatar_value)
  }

  getDb()
    .prepare(
      `UPDATE profile SET display_name = ?, avatar_type = ?, avatar_value = ?, onboarded = 1,
       updated_at = datetime('now') WHERE id = ?`
    )
    .run(cleanName(input?.displayName), type, value, current.id)
  return getProfile()
}

// Bấm "Bỏ qua" ở hộp thoại chào mừng: giữ hồ sơ mặc định, không hỏi lại
export function skipOnboarding(): Profile {
  const profile = getProfile()
  getDb().prepare('UPDATE profile SET onboarded = 1 WHERE id = ?').run(profile.id)
  return getProfile()
}

// game-media://avatar/<tên file>
export function avatarResponse(fileName: string): Promise<Response> | Response {
  if (!SAFE_FILE_NAME.test(fileName)) return new Response('Not found', { status: 404 })
  return net.fetch(pathToFileURL(join(avatarsDir(), fileName)).toString())
}
