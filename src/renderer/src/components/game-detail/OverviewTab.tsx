import { formatBytes, formatPlaytime, formatRelative } from '../../utils/gameArt'
import { FolderIcon } from '../Icons'

interface OverviewTabProps {
  game: Game
  details: SteamDetailsResult | undefined
  install: InstallInfo | undefined
  onOpenFolder: () => void
  onShowMedia: () => void
}

function InfoRow({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{children}</span>
    </div>
  )
}

function steamLinks(appId: string, website: string | null): { label: string; url: string }[] {
  return [
    { label: 'Trang Steam', url: `https://store.steampowered.com/app/${appId}/` },
    { label: 'SteamDB', url: `https://steamdb.info/app/${appId}/` },
    // Hướng dẫn sửa lỗi, cấu hình, vị trí file save...
    { label: 'PCGamingWiki', url: `https://www.pcgamingwiki.com/api/appid.php?appid=${appId}` },
    ...(website ? [{ label: 'Trang chủ game', url: website }] : [])
  ]
}

export function OverviewTab({
  game,
  details,
  install,
  onOpenFolder,
  onShowMedia
}: OverviewTabProps): React.JSX.Element {
  const steam = details?.details
  const appId = game.steam_app_id ?? game.source_id
  const isSteamUri = /^steam:\/\//i.test(game.exe_path.trim())
  const links = appId
    ? steamLinks(appId, steam?.website ?? null)
    : [
        {
          label: 'Tìm trên PCGamingWiki',
          url: `https://www.pcgamingwiki.com/w/index.php?search=${encodeURIComponent(game.title)}`
        }
      ]
  const genres = steam?.genres.length ? steam.genres.join(', ') : game.genre

  return (
    <div className="detail-overview">
      <div className="detail-main">
        <section className="detail-card">
          <h3>Giới thiệu</h3>
          {steam?.description ? (
            <p className="detail-description">{steam.description}</p>
          ) : (
            <p className="detail-muted">
              {details === undefined
                ? 'Đang tải thông tin...'
                : appId
                  ? (details.error ?? 'Steam không có mô tả cho game này.')
                  : 'Game không có trên Steam nên chưa có mô tả. Bạn có thể ghi chú riêng ở tab Ghi chú.'}
            </p>
          )}
          {details?.stale && (
            <p className="detail-muted small">
              Không tải được bản mới, đang hiện thông tin đã lưu.
            </p>
          )}

          <div className="info-grid">
            {steam?.developers.length ? (
              <InfoRow label="Nhà phát triển">{steam.developers.join(', ')}</InfoRow>
            ) : null}
            {steam?.publishers.length ? (
              <InfoRow label="Nhà phát hành">{steam.publishers.join(', ')}</InfoRow>
            ) : null}
            {steam?.releaseDate && <InfoRow label="Phát hành">{steam.releaseDate}</InfoRow>}
            {genres && <InfoRow label="Thể loại">{genres}</InfoRow>}
            {steam?.metacritic && <InfoRow label="Metacritic">{steam.metacritic}/100</InfoRow>}
            <InfoRow label="Thêm vào thư viện">{formatRelative(game.created_at)}</InfoRow>
            <InfoRow label="Thời gian chơi">{formatPlaytime(game.total_playtime)}</InfoRow>
          </div>
        </section>

        {steam && steam.screenshots.length > 0 && (
          <button className="detail-screens-preview" onClick={onShowMedia} title="Xem ảnh & video">
            {steam.screenshots.slice(0, 4).map((s) => (
              <img key={s.thumb} src={s.thumb} alt="" loading="lazy" draggable={false} />
            ))}
          </button>
        )}
      </div>

      <aside className="detail-side">
        <section className="detail-card">
          <h3>Cài đặt</h3>
          <div className="info-list">
            <InfoRow label="Nguồn">{game.source === 'steam' ? 'Steam' : 'Tự thêm'}</InfoRow>
            {appId && <InfoRow label="Steam App ID">{appId}</InfoRow>}
            <InfoRow label={isSteamUri ? 'Mở qua' : 'File chạy'}>
              <span className="info-path" title={game.exe_path}>
                {game.exe_path}
              </span>
            </InfoRow>
            {game.process_name && <InfoRow label="Tiến trình">{game.process_name}</InfoRow>}
            <InfoRow label="Thư mục">
              {install === undefined ? (
                'Đang tìm...'
              ) : install.path ? (
                <span className="info-path" title={install.path}>
                  {install.path}
                </span>
              ) : (
                'Không tìm thấy trên máy'
              )}
            </InfoRow>
            {install?.path && (
              <InfoRow label="Dung lượng">
                {install.size
                  ? `${install.size.partial ? '> ' : ''}${formatBytes(install.size.bytes)} · ${install.size.files.toLocaleString('vi-VN')} file`
                  : 'Đang tính...'}
              </InfoRow>
            )}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            disabled={!install?.path}
            onClick={onOpenFolder}
          >
            <FolderIcon width={15} height={15} /> Mở thư mục game
          </button>
        </section>

        <section className="detail-card">
          <h3>Liên kết</h3>
          <div className="detail-links">
            {links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
                {l.label} ↗
              </a>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}
