import { useEffect, useState } from 'react'

// Bật/tắt tự nhận game mở ngoài Nexus
export function TrackingSettingsCard(): React.JSX.Element {
  const api = window.electronAPI.games
  const [info, setInfo] = useState<TrackingInfo | null>(null)

  useEffect(() => {
    api.getTrackingInfo().then(setInfo)
  }, [api])

  const toggle = async (enabled: boolean): Promise<void> => {
    const autoDetect = await api.setAutoDetect(enabled)
    setInfo((prev) => (prev ? { ...prev, autoDetect } : prev))
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
    </div>
  )
}
