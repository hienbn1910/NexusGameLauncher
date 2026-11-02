import { useState } from 'react'
import { useUpdateStatus } from '../hooks/useUpdateStatus'

const RELEASES_URL = 'https://github.com/hienbn1910/NexusGameLauncher/releases'

const STATE_TEXT: Record<UpdateStatus['state'], string> = {
  disabled: 'Bản dev không tự cập nhật.',
  idle: '',
  checking: 'Đang kiểm tra bản mới...',
  downloading: '',
  ready: '',
  latest: 'Bạn đang dùng bản mới nhất.',
  error: 'Không kiểm tra được bản cập nhật. Thử lại sau.'
}

// Phiên bản app, kiểm tra và cài bản cập nhật
export function UpdateSettingsCard(): React.JSX.Element {
  const status = useUpdateStatus()
  const [checking, setChecking] = useState(false)

  const check = async (): Promise<void> => {
    setChecking(true)
    await window.electronAPI.app.checkForUpdates()
    setChecking(false)
  }

  if (!status) return <div className="update-settings" />

  const text =
    status.state === 'downloading'
      ? `Đang tải bản ${status.version} (${status.progress ?? 0}%)...`
      : status.state === 'ready'
        ? `Đã tải xong bản ${status.version}.`
        : STATE_TEXT[status.state]

  return (
    <div className="update-settings">
      <p className="update-settings-version">
        Phiên bản <strong>{status.currentVersion}</strong>
        {text && <span className="field-hint"> · {text}</span>}
      </p>
      <div className="update-settings-actions">
        {status.state === 'ready' ? (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => window.electronAPI.app.installUpdate()}
          >
            Khởi động lại để cập nhật
          </button>
        ) : (
          <button
            className="btn btn-secondary btn-sm"
            disabled={
              checking ||
              status.state === 'disabled' ||
              status.state === 'checking' ||
              status.state === 'downloading'
            }
            onClick={check}
          >
            {checking ? 'Đang kiểm tra...' : 'Kiểm tra cập nhật'}
          </button>
        )}
        <a className="link-button" href={RELEASES_URL} target="_blank" rel="noreferrer">
          Xem các bản phát hành
        </a>
      </div>
    </div>
  )
}
