import { ApiKeyForm } from '../components/ApiKeyForm'
import { GlobeIcon, ImageIcon, LayersIcon, type IconComponent } from '../components/Icons'
import { NetworkSettingsCard } from '../components/NetworkSettingsCard'
import { NewsSourcesCard } from '../components/NewsSourcesCard'

function SettingsCard({
  icon: Icon,
  title,
  description,
  children
}: {
  icon: IconComponent
  title: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="settings-card">
      <header className="settings-card-header">
        <span className="settings-card-icon">
          <Icon width={18} height={18} />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

export function SettingsPage(): React.JSX.Element {
  return (
    <div className="settings">
      <SettingsCard
        icon={GlobeIcon}
        title="Mạng"
        description="Dùng khi không vào được Steam (tin tức, ảnh bìa). Chỉ áp dụng cho Nexus Launcher."
      >
        <NetworkSettingsCard />
      </SettingsCard>

      <SettingsCard
        icon={LayersIcon}
        title="Nguồn tin tức"
        description='Các trang báo game hiển thị ở tab "Tin game" trên trang chủ.'
      >
        <NewsSourcesCard />
      </SettingsCard>

      <SettingsCard
        icon={ImageIcon}
        title="Ảnh bìa tự động · SteamGridDB"
        description="Dùng để tìm ảnh bìa online trong form thêm/sửa game."
      >
        <ApiKeyForm />
      </SettingsCard>
    </div>
  )
}
