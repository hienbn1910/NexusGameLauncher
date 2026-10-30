import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { TrashIcon, XIcon } from './Icons'

interface ResetDataModalProps {
  info: DataInfo | null
  onClose: () => void
}

// Từ phải gõ đúng mới bấm được nút xoá (tránh bấm nhầm)
const CONFIRM_WORD = 'RESET'

const WILL_DELETE = [
  'Toàn bộ thư viện game và cài đặt từng game (thư mục game, ghi chú, yêu thích)',
  'Giờ chơi, lịch sử phiên chơi và thống kê',
  'Ảnh bìa, logo đã tải hoặc tự chọn',
  'Hồ sơ (tên, ảnh đại diện)',
  'Game đang theo dõi tin tức, nguồn tin, tin và ảnh đã lưu',
  'Cài đặt mạng, API key SteamGridDB và các tuỳ chọn khác'
]

// Hộp thoại xác nhận xoá toàn bộ dữ liệu, đưa app về như mới cài
export function ResetDataModal({ info, onClose }: ResetDataModalProps): React.JSX.Element {
  const [typed, setTyped] = useState('')
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const working = status === 'working'

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !working) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [working, onClose])

  const reset = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (typed.trim().toUpperCase() !== CONFIRM_WORD || working) return
    setStatus('working')
    const result = await window.electronAPI.app.resetData()
    if (result.ok) {
      // Dữ liệu đã xoá => tải lại giao diện, app mở lại như mới cài (hỏi tên lần đầu...)
      window.location.reload()
      return
    }
    setStatus('error')
    setError(result.error)
  }

  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD

  return createPortal(
    <div className="modal-overlay" onMouseDown={working ? undefined : onClose}>
      <form className="modal reset-modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={reset}>
        <div className="modal-header">
          <h2>Xoá toàn bộ dữ liệu?</h2>
          <button
            type="button"
            className="icon-button"
            title="Đóng"
            disabled={working}
            onClick={onClose}
          >
            <XIcon />
          </button>
        </div>

        <div className="modal-body">
          <div className="reset-warning">
            <strong>Không thể hoàn tác.</strong> Nexus Launcher sẽ trở về như lúc mới cài đặt. Những
            dữ liệu sau sẽ bị xoá vĩnh viễn:
          </div>
          <ul className="reset-list">
            {WILL_DELETE.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="field-hint">
            File game trên máy <strong>không bị ảnh hưởng</strong>, chỉ xoá dữ liệu của Nexus
            {info ? ` (${info.files.toLocaleString('vi-VN')} file trong ${info.path})` : ''}.
          </p>

          <label className="field">
            <span className="field-label">
              Gõ <code className="reset-word">{CONFIRM_WORD}</code> để xác nhận
            </span>
            <input
              className="input"
              value={typed}
              placeholder={CONFIRM_WORD}
              autoFocus
              disabled={working}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>

          {status === 'error' && error && (
            <div className="form-error">
              {error}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => window.location.reload()}
              >
                Tải lại app
              </button>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" disabled={working} onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className="btn btn-danger" disabled={!confirmed || working}>
            <TrashIcon width={16} height={16} />
            {working ? 'Đang xoá...' : 'Xoá toàn bộ dữ liệu'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  )
}
