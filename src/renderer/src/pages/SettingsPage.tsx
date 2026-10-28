import { ApiKeyForm } from '../components/ApiKeyForm'
import { ImageIcon } from '../components/Icons'

export function SettingsPage(): React.JSX.Element {
  return (
    <div className="settings">
      <section className="settings-card">
        <header className="settings-card-header">
          <span className="settings-card-icon">
            <ImageIcon width={18} height={18} />
          </span>
          <div>
            <h3>Ảnh bìa tự động · SteamGridDB</h3>
            <p>Dùng để tìm ảnh bìa online trong form thêm/sửa game.</p>
          </div>
        </header>
        <ApiKeyForm />
      </section>
    </div>
  )
}
