import { safeStorage } from 'electron'
import { getDb } from '../database'

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    { value: string | null } | undefined
  return row?.value ?? null
}

// value = null để xoá
export function setSetting(key: string, value: string | null): void {
  const db = getDb()
  if (value === null) {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key)
  } else {
    db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, value)
  }
}

// Giá trị bí mật (API key) được mã hoá bằng safeStorage (DPAPI trên Windows)
// nên file database bị copy sang máy khác cũng không đọc được
export function getSecret(key: string): string | null {
  const stored = getSetting(key)
  if (!stored) return null
  if (stored.startsWith('enc:')) {
    try {
      return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'))
    } catch {
      return null // Không giải mã được (vd đổi user Windows)
    }
  }
  return stored.replace(/^plain:/, '')
}

export function setSecret(key: string, value: string | null): void {
  if (!value) return setSetting(key, null)
  if (safeStorage.isEncryptionAvailable()) {
    setSetting(key, `enc:${safeStorage.encryptString(value).toString('base64')}`)
  } else {
    setSetting(key, `plain:${value}`)
  }
}
