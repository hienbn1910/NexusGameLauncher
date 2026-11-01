import { useEffect, useState } from 'react'
import { SaveIcon, TrashIcon } from './Icons'

const API_KEY_PAGE = 'https://www.steamgriddb.com/profile/preferences/api'

interface ApiKeyFormProps {
  onSaved?: () => void
}

// Nhập / xoá SteamGridDB API key riêng. Key được kiểm tra với server trước khi lưu.
// Chưa nhập key riêng thì app dùng key mặc định của Nexus (nếu bản build có).
export function ApiKeyForm({ onSaved }: ApiKeyFormProps): React.JSX.Element {
  const [status, setStatus] = useState<SgdbKeyStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  useEffect(() => {
    window.electronAPI.steamGridDb.getKeyStatus().then(setStatus)
  }, [])

  const hasUserKey = status?.source === 'user'

  const save = async (value: string): Promise<void> => {
    setSaving(true)
    setMessage(null)
    const result = await window.electronAPI.steamGridDb.saveApiKey(value)
    setSaving(false)

    if (!result.ok) return setMessage({ type: 'error', text: result.error })
    setApiKey('')
    setStatus(await window.electronAPI.steamGridDb.getKeyStatus())
    setMessage({ type: 'success', text: value.trim() ? 'Đã lưu API key' : 'Đã xoá API key' })
    if (value.trim()) onSaved?.()
  }

  return (
    <div className="api-key-form">
      {status && !hasUserKey && (
        <p className={`api-key-status ${status.source === 'default' ? 'ok' : 'warn'}`}>
          {status.source === 'default'
            ? '✓ Đang dùng key mặc định của Nexus, không cần nhập gì thêm. Bạn vẫn có thể nhập key riêng.'
            : status.defaultBroken
              ? 'Key mặc định của Nexus không còn dùng được. Hãy nhập key của bạn để tiếp tục tìm ảnh online.'
              : 'Chưa có API key. Nhập key để tìm ảnh bìa online.'}
        </p>
      )}
      <p className="api-key-desc">
        Tạo API key miễn phí tại{' '}
        <a href={API_KEY_PAGE} target="_blank" rel="noreferrer">
          steamgriddb.com/profile/preferences/api
        </a>{' '}
        (cần đăng nhập bằng tài khoản Steam), rồi dán vào đây.
      </p>

      <div className="api-key-row">
        <input
          className="input"
          type="password"
          placeholder={
            hasUserKey ? '•••••••••••• (đã lưu, nhập key mới để thay)' : 'Dán API key của bạn...'
          }
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (apiKey.trim()) void save(apiKey)
            }
          }}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={saving || !apiKey.trim()}
          onClick={() => save(apiKey)}
        >
          <SaveIcon width={16} height={16} />
          {saving ? 'Đang kiểm tra...' : 'Lưu'}
        </button>
        {hasUserKey && (
          <button
            type="button"
            className="btn btn-danger-ghost btn-sm"
            disabled={saving}
            onClick={() => save('')}
            title="Xoá key của bạn (quay về key mặc định nếu có)"
          >
            <TrashIcon width={16} height={16} />
          </button>
        )}
      </div>

      {message && <p className={`api-key-message ${message.type}`}>{message.text}</p>}
    </div>
  )
}
