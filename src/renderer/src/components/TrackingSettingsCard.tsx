import { useEffect, useState } from 'react'

// Bật/tắt tự nhận game mở ngoài Nexus, chạy nền ở khay hệ thống, khởi động cùng Windows
export function TrackingSettingsCard(): React.JSX.Element {
  const api = window.electronAPI.games
  const appApi = window.electronAPI.app
  const [info, setInfo] = useState<TrackingInfo | null>(null)
  const [background, setBackground] = useState<BackgroundSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getTrackingInfo().then(setInfo)
    appApi.getBackgroundSettings().then(setBackground)
  }, [api, appApi])

  const toggle = async (enabled: boolean): Promise<void> => {
    const autoDetect = await api.setAutoDetect(enabled)
    setInfo((prev) => (prev ? { ...prev, autoDetect } : prev))
  }

  const toggleTray = async (enabled: boolean): Promise<void> => {
    setBackground(await appApi.setCloseToTray(enabled))
  }

  const toggleAutoStart = async (enabled: boolean): Promise<void> => {
    setError(null)
    const result = await appApi.setOpenAtLogin(enabled)
    if (result.ok) setBackground(result.data)
    else setError(result.error)
  }

  return (
    <div className="tracking-settings">
      <label className="news-source">
        <input
          type="checkbox"
          checked={info?.autoDetect ?? true}
          disabled={!info}
          onChange={(e) => toggle(e.target.checked)}
        />
        <span className="news-source-name">Tự nhận game mở ngoài Nexus</span>
      </label>
      <p className="field-hint">
        Mở game bằng shortcut, Steam hay launcher riêng vẫn được tính giờ chơi. App kiểm tra mỗi 15
        giây khi rảnh và mỗi 5 giây khi đang có game chạy.
        {info && !info.nativeProcessApi && ' (Đang dùng chế độ dự phòng, chậm hơn.)'}
      </p>

      <label className="news-source">
        <input
          type="checkbox"
          checked={background?.closeToTray ?? true}
          disabled={!background}
          onChange={(e) => toggleTray(e.target.checked)}
        />
        <span className="news-source-name">Đóng cửa sổ thì chạy nền ở khay hệ thống</span>
      </label>
      <p className="field-hint">
        Nexus chỉ tính được giờ chơi khi đang chạy. Tắt tuỳ chọn này thì đóng cửa sổ là thoát hẳn.
        Thoát từ khay: chuột phải vào biểu tượng Nexus → Thoát.
      </p>

      <label className="news-source">
        <input
          type="checkbox"
          checked={background?.openAtLogin ?? false}
          disabled={!background?.canAutoStart}
          onChange={(e) => toggleAutoStart(e.target.checked)}
        />
        <span className="news-source-name">Khởi động cùng Windows</span>
      </label>
      <p className="field-hint">
        Chạy ẩn ở khay khi bật máy để tính cả giờ chơi của game mở ngoài Nexus.
        {background && !background.canAutoStart && ' (Chỉ bật được ở bản cài đặt.)'}
      </p>
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
