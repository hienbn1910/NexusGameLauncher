import { ApiKeyForm } from './ApiKeyForm'
import { ImageIcon, XIcon } from './Icons'

interface SteamGridDbSetupModalProps {
  onClose: () => void
}

// Bước cuối lần đầu mở app: nhập SteamGridDB API key để tìm ảnh bìa online (không bắt buộc,
// có thể nhập sau trong Cài đặt)
export function SteamGridDbSetupModal({ onClose }: SteamGridDbSetupModalProps): React.JSX.Element {
  return (
    <div className="modal-overlay">
      <div className="modal sgdb-setup-modal" role="dialog" aria-labelledby="sgdb-setup-title">
        <div className="modal-header">
          <h2 id="sgdb-setup-title">Ảnh bìa đẹp hơn</h2>
          <button type="button" className="icon-button" onClick={onClose} title="Đóng">
            <XIcon />
          </button>
        </div>

        <div className="modal-body">
          <div className="sgdb-setup-intro">
            <span className="settings-card-icon">
              <ImageIcon width={18} height={18} />
            </span>
            <p>
              Nexus tự lấy ảnh cho game Steam. Với game khác, bạn có thể tìm ảnh bìa đẹp trên{' '}
              <strong>SteamGridDB</strong> nếu có API key (miễn phí).{' '}
              <span className="sgdb-setup-optional">
                Không bắt buộc: bỏ qua được và nhập sau trong Cài đặt.
              </span>
            </p>
          </div>
          <ApiKeyForm onSaved={onClose} />
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Bỏ qua
          </button>
        </div>
      </div>
    </div>
  )
}
