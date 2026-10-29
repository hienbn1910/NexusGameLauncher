import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AVATAR_PRESETS, DEFAULT_PROFILE_NAME, MAX_PROFILE_NAME } from '../utils/avatar'
import { Avatar } from './Avatar'
import { ImageIcon, XIcon } from './Icons'

interface ProfileModalProps {
  profile: UserProfile
  // welcome: lần đầu mở app (có "Bỏ qua"), edit: sửa hồ sơ
  mode: 'welcome' | 'edit'
  onClose: () => void
  onSaved: (profile: UserProfile) => void
}

// Lựa chọn avatar trong hộp thoại; image.preview là ảnh để hiển thị
type AvatarChoice =
  | { type: 'initials' }
  | { type: 'preset'; value: string }
  | { type: 'image'; path?: string; preview: string }

function initialChoice(profile: UserProfile): AvatarChoice {
  const { type, value } = profile.avatar
  if (type === 'preset' && value) return { type, value }
  if (type === 'image' && value) return { type, preview: value }
  return { type: 'initials' }
}

export function ProfileModal({
  profile,
  mode,
  onClose,
  onSaved
}: ProfileModalProps): React.JSX.Element {
  const api = window.electronAPI.profile
  const welcome = mode === 'welcome'
  // Lần đầu: ô tên để trống cho người dùng tự gõ
  const [name, setName] = useState(welcome ? '' : profile.displayName)
  const [choice, setChoice] = useState<AvatarChoice>(() => initialChoice(profile))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Hộp thoại chào mừng không đóng bằng Esc, phải chọn "Bắt đầu" hoặc "Bỏ qua"
  useEffect(() => {
    if (welcome) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [welcome, onClose])

  const previewName = name.trim() || DEFAULT_PROFILE_NAME
  const preview =
    choice.type === 'image'
      ? { type: 'image' as const, value: choice.preview }
      : choice.type === 'preset'
        ? { type: 'preset' as const, value: choice.value }
        : { type: 'initials' as const, value: null }

  const applyImage = (picked: { path: string; preview: string } | null): void => {
    if (!picked) return setError('Không đọc được ảnh. Hãy chọn file PNG, JPG hoặc BMP.')
    setError(null)
    setChoice({ type: 'image', path: picked.path, preview: picked.preview })
  }

  const pickImage = async (): Promise<void> => {
    const picked = await api.pickAvatar()
    if (picked) applyImage(picked)
  }

  const handleDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    applyImage(await api.previewAvatar(window.electronAPI.games.getPathForFile(file)))
  }

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    const avatar: AvatarInput =
      choice.type === 'image' ? { type: 'image', path: choice.path } : choice
    const result = await api.save({ displayName: name, avatar })
    setSaving(false)
    if (!result.ok) return setError(result.error)
    onSaved(result.data)
  }

  const skip = async (): Promise<void> => {
    onSaved(await api.skipOnboarding())
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={welcome ? undefined : onClose}>
      <form
        className={`modal profile-modal ${welcome ? 'welcome' : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={save}
      >
        {welcome ? (
          <div className="profile-welcome">
            <h2>Chào mừng đến với Nexus Launcher</h2>
            <p>Bạn muốn được gọi là gì? Có thể đổi lại bất cứ lúc nào.</p>
          </div>
        ) : (
          <div className="modal-header">
            <h2>Hồ sơ của bạn</h2>
            <button type="button" className="icon-button" title="Đóng" onClick={onClose}>
              <XIcon />
            </button>
          </div>
        )}

        <div className="modal-body">
          <div className="profile-editor">
            <button
              type="button"
              className={`profile-avatar-drop ${dragOver ? 'drag-over' : ''}`}
              title="Chọn hoặc kéo-thả ảnh vào đây"
              onClick={pickImage}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Avatar name={previewName} type={preview.type} value={preview.value} size={96} />
              <span className="profile-avatar-overlay">
                <ImageIcon width={20} height={20} />
              </span>
            </button>

            <label className="field profile-name-field">
              <span className="field-label">Tên hiển thị</span>
              <input
                className="input"
                value={name}
                placeholder={DEFAULT_PROFILE_NAME}
                maxLength={MAX_PROFILE_NAME}
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
              <span className="field-hint">
                {name.trim() ? `${name.trim().length}/${MAX_PROFILE_NAME}` : ' '}
              </span>
            </label>
          </div>

          <div className="field">
            <span className="field-label">Ảnh đại diện</span>
            <div className="avatar-options">
              <button
                type="button"
                className={`avatar-option ${choice.type === 'initials' ? 'active' : ''}`}
                title="Chữ cái đầu của tên"
                onClick={() => setChoice({ type: 'initials' })}
              >
                <Avatar name={previewName} type="initials" value={null} size={40} />
              </button>
              {AVATAR_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`avatar-option ${choice.type === 'preset' && choice.value === p.id ? 'active' : ''}`}
                  onClick={() => setChoice({ type: 'preset', value: p.id })}
                >
                  <Avatar name={previewName} type="preset" value={p.id} size={40} />
                </button>
              ))}
              <button
                type="button"
                className={`avatar-option upload ${choice.type === 'image' ? 'active' : ''}`}
                title="Tải ảnh từ máy"
                onClick={pickImage}
              >
                {choice.type === 'image' ? (
                  <Avatar name={previewName} type="image" value={choice.preview} size={40} />
                ) : (
                  <ImageIcon width={18} height={18} />
                )}
              </button>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="modal-footer">
          {welcome ? (
            <button type="button" className="btn btn-ghost" onClick={skip}>
              Bỏ qua
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Huỷ
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Đang lưu...' : welcome ? 'Bắt đầu' : 'Lưu'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  )
}
