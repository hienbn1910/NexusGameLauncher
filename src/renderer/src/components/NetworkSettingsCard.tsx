import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { SaveIcon, XIcon } from './Icons'

const DNS_OPTIONS: { key: DnsProvider; label: string }[] = [
  { key: 'off', label: 'Tắt' },
  { key: 'cloudflare', label: 'Cloudflare 1.1.1.1' },
  { key: 'google', label: 'Google 8.8.8.8' }
]

const PROXY_OPTIONS: { key: ProxyMode; label: string }[] = [
  { key: 'system', label: 'Dùng proxy của hệ thống' },
  { key: 'direct', label: 'Không dùng proxy' },
  { key: 'custom', label: 'Tự nhập proxy' }
]

// Bật DNS bảo mật hoặc proxy riêng => cần hỏi lại người dùng trước khi lưu
const usesBypass = (s: NetworkSettings): boolean => s.dns !== 'off' || s.proxyMode === 'custom'

function ConfirmDialog({
  onCancel,
  onConfirm
}: {
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  return createPortal(
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Lưu ý trước khi bật</h2>
          <button className="icon-button" onClick={onCancel} title="Đóng">
            <XIcon />
          </button>
        </div>
        <div className="modal-body network-confirm">
          <p>
            Tuỳ chọn này <strong>chỉ áp dụng cho Nexus Launcher</strong> (tin tức, ảnh bìa...),
            không thay đổi mạng của các ứng dụng khác trên máy.
          </p>
          <p>
            DNS bảo mật giúp vượt qua việc chặn tên miền của nhà mạng. Nếu nhà mạng chặn theo cách
            khác thì có thể cần thêm proxy.
          </p>
          <p className="confirm-note">
            Việc vượt chặn có thể bị hạn chế ở một số quốc gia. Bạn tự chịu trách nhiệm tuân thủ quy
            định nơi mình sinh sống.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>
            Huỷ
          </button>
          <button className="btn btn-primary" autoFocus onClick={onConfirm}>
            Tôi hiểu, bật
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Cài đặt mạng: DNS bảo mật + proxy, kiểm tra kết nối Steam
export function NetworkSettingsCard(): React.JSX.Element {
  const api = window.electronAPI.network
  const [saved, setSaved] = useState<NetworkSettings | null>(null)
  const [draft, setDraft] = useState<NetworkSettings | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [test, setTest] = useState<ConnectionTest | 'testing' | null>(null)

  useEffect(() => {
    api.getSettings().then((s) => {
      setSaved(s)
      setDraft(s)
    })
  }, [api])

  if (!saved || !draft) return <p className="field-hint">Đang tải...</p>

  const dirty =
    draft.dns !== saved.dns ||
    draft.proxyMode !== saved.proxyMode ||
    (draft.proxyMode === 'custom' && draft.proxyUrl.trim() !== saved.proxyUrl)

  const save = async (): Promise<void> => {
    setConfirming(false)
    setSaving(true)
    setMessage(null)
    const result = await api.saveSettings(draft)
    setSaving(false)
    if (!result.ok) return setMessage({ ok: false, text: result.error })
    setSaved(result.data)
    setDraft(result.data)
    setTest(null)
    setMessage({
      ok: true,
      text: 'Đã áp dụng ngay, không cần khởi động lại. Bấm "Làm mới" ở mục tin tức để tải lại.'
    })
  }

  const requestSave = (): void => {
    // Chỉ hỏi khi chuyển từ "không vượt chặn" sang "có vượt chặn"
    if (usesBypass(draft) && !usesBypass(saved)) setConfirming(true)
    else void save()
  }

  const runTest = async (): Promise<void> => {
    setTest('testing')
    setTest(await api.testSteam())
  }

  return (
    <div className="network-settings">
      <div className="field">
        <span className="field-label">DNS bảo mật (DNS over HTTPS)</span>
        <div className="segmented">
          {DNS_OPTIONS.map((o) => (
            <button
              key={o.key}
              className={draft.dns === o.key ? 'active' : ''}
              onClick={() => setDraft({ ...draft, dns: o.key })}
            >
              {o.label}
            </button>
          ))}
        </div>
        <span className="field-hint">
          Hỏi địa chỉ máy chủ qua kết nối mã hoá tới Cloudflare/Google, giúp vào được Steam khi nhà
          mạng chặn tên miền.
        </span>
      </div>

      <div className="field">
        <span className="field-label">Proxy</span>
        <div className="network-proxy">
          <select
            className="input"
            value={draft.proxyMode}
            onChange={(e) => setDraft({ ...draft, proxyMode: e.target.value as ProxyMode })}
          >
            {PROXY_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          {draft.proxyMode === 'custom' && (
            <input
              className="input"
              placeholder="socks5://127.0.0.1:40000"
              value={draft.proxyUrl}
              onChange={(e) => setDraft({ ...draft, proxyUrl: e.target.value })}
            />
          )}
        </div>
        <span className="field-hint">
          Hỗ trợ http://, https://, socks4://, socks5://. Ví dụ ứng dụng Cloudflare WARP ở chế độ
          proxy dùng socks5://127.0.0.1:40000.
        </span>
      </div>

      {message && <p className={message.ok ? 'form-success' : 'form-error'}>{message.text}</p>}

      <div className="network-actions">
        <button className="btn btn-secondary" disabled={test === 'testing'} onClick={runTest}>
          {test === 'testing' ? 'Đang kiểm tra...' : 'Kiểm tra kết nối Steam'}
        </button>
        {test && test !== 'testing' && (
          <span className={`network-test ${test.ok ? 'ok' : 'fail'}`}>
            {test.ok ? `✓ Kết nối được (${test.ms} ms)` : `✗ ${test.error}`}
          </span>
        )}
        <button
          className="btn btn-primary network-save"
          disabled={!dirty || saving}
          onClick={requestSave}
        >
          <SaveIcon width={16} height={16} /> {saving ? 'Đang áp dụng...' : 'Lưu & áp dụng'}
        </button>
      </div>

      {confirming && <ConfirmDialog onCancel={() => setConfirming(false)} onConfirm={save} />}
    </div>
  )
}
