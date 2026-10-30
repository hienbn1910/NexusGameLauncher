import { useEffect, useState } from 'react'
import { formatBytes } from '../utils/gameArt'
import { FolderIcon, TrashIcon } from './Icons'
import { ResetDataModal } from './ResetDataModal'

// Dữ liệu của app: nơi lưu, dung lượng, mở thư mục, xoá toàn bộ về như mới cài
export function DataSettingsCard(): React.JSX.Element {
  const api = window.electronAPI.app
  const [info, setInfo] = useState<DataInfo | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getDataInfo().then(setInfo)
  }, [api])

  const openFolder = async (): Promise<void> => {
    const result = await api.openDataFolder()
    setError(result.ok ? null : result.error)
  }

  return (
    <div className="data-settings">
      <div className="data-settings-row">
        <div className="data-settings-info">
          <span className="info-path" title={info?.path}>
            {info?.path ?? 'Đang tải...'}
          </span>
          <span className="field-hint">
            {info
              ? `${formatBytes(info.bytes)} · ${info.files.toLocaleString('vi-VN')} file (database, ảnh bìa, ảnh đại diện, ảnh tin tức)`
              : ' '}
          </span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={openFolder}>
          <FolderIcon width={15} height={15} /> Mở thư mục
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}

      <div className="danger-zone">
        <div>
          <strong>Xoá toàn bộ dữ liệu</strong>
          <p>
            Đưa Nexus Launcher về như mới cài: xoá thư viện game, giờ chơi, ảnh bìa, hồ sơ và mọi
            cài đặt. File game trên máy không bị ảnh hưởng.
          </p>
        </div>
        <button className="btn btn-danger-outline btn-sm" onClick={() => setConfirming(true)}>
          <TrashIcon width={15} height={15} /> Xoá dữ liệu...
        </button>
      </div>

      {confirming && <ResetDataModal info={info} onClose={() => setConfirming(false)} />}
    </div>
  )
}
