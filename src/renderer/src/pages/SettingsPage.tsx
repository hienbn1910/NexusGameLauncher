import { ApiKeyForm } from '../components/ApiKeyForm'
import { AppearanceSettingsCard } from '../components/AppearanceSettingsCard'
import { Avatar } from '../components/Avatar'
import { DataSettingsCard } from '../components/DataSettingsCard'
import { TrackingSettingsCard } from '../components/TrackingSettingsCard'
import {
  ClockIcon,
  FolderIcon,
  GlobeIcon,
  ImageIcon,
  LayersIcon,
  PaletteIcon,
  PencilIcon,
  UserIcon,
  type IconComponent
} from '../components/Icons'
import { DEFAULT_PROFILE_NAME } from '../utils/avatar'
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

interface SettingsPageProps {
  profile: UserProfile | null
  onEditProfile: () => void
}

export function SettingsPage({ profile, onEditProfile }: SettingsPageProps): React.JSX.Element {
  const name = profile?.displayName ?? DEFAULT_PROFILE_NAME
  return (
    <div className="settings">
      <SettingsCard
        icon={UserIcon}
        title="Hồ sơ"
        description="Tên và ảnh đại diện hiển thị trong app. Hiện được lưu trên máy này."
      >
        <div className="settings-profile">
          <Avatar
            name={name}
            type={profile?.avatar.type ?? 'initials'}
            value={profile?.avatar.value ?? null}
            size={48}
          />
          <div className="settings-profile-info">
            <strong>{name}</strong>
            <span>Tài khoản trên máy · chưa đăng nhập</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onEditProfile}>
            <PencilIcon width={14} height={14} /> Chỉnh sửa
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={PaletteIcon}
        title="Giao diện"
        description="Đổi phong cách hiển thị của app. Một số giao diện cần mở khoá."
      >
        <AppearanceSettingsCard />
      </SettingsCard>

      <SettingsCard
        icon={ClockIcon}
        title="Theo dõi giờ chơi"
        description="Tính giờ theo thư mục game: mọi exe trong thư mục cài game đều được tính là đang chơi."
      >
        <TrackingSettingsCard />
      </SettingsCard>

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

      <SettingsCard
        icon={FolderIcon}
        title="Dữ liệu"
        description="Thư viện game, giờ chơi, ảnh bìa và cài đặt của Nexus được lưu trên máy này."
      >
        <DataSettingsCard />
      </SettingsCard>
    </div>
  )
}
