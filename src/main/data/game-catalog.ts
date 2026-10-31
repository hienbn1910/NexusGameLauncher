// Danh mục game phổ biến: gợi ý ở lần đầu mở app + cách tự tìm game trên máy.
// Chỉ là dữ liệu, sửa / thêm game ở đây (sau này có thể tải danh mục mới từ máy chủ).

export interface CatalogGame {
  id: string
  title: string
  genre: string
  // Game có trên Steam: mở qua steam://rungameid (Steam tự cài nếu chưa có)
  steamAppId?: string
  // Game của Riot: mở qua Riot Client với --launch-product=<riotProduct>
  riotProduct?: string
  // Tìm trong danh sách phần mềm đã cài của Windows (registry Uninstall) theo tên hiển thị
  uninstall?: {
    name: RegExp
    // File chạy, tính từ thư mục cài; thử lần lượt, file đầu tiên tồn tại được chọn
    exe: string[]
    // Thư mục chứa game thật (tính giờ chơi), tính từ thư mục cài; bỏ trống = cả thư mục cài
    gameDir?: string
  }
  // Game cài qua launcher chung (vd HoYoPlay): tên launcher trong registry + đường dẫn game bên trong
  hostLauncher?: {
    name: RegExp
    exe: string[] // File chạy, tính từ thư mục launcher
    // Thư mục game, tính từ thư mục launcher (thử lần lượt; game phải có ở đây mới coi là đã cài)
    gameDir: string[]
  }
  // Exe của game thật để lấy icon (tính từ thư mục game; thử lần lượt). Khi file chạy là launcher
  // chung (Riot Client, HoYoPlay) thì icon game khác icon launcher
  gameExe?: string[]
}

// HoYoPlay: launcher chung của HoYoverse (Genshin, Star Rail, ZZZ)
const hoyoPlay = (gameDir: string[]): CatalogGame['hostLauncher'] => ({
  name: /^HoYoPlay\b/i,
  exe: ['launcher.exe'],
  gameDir
})

export const GAME_CATALOG: CatalogGame[] = [
  {
    id: 'league-of-legends',
    title: 'Liên Minh Huyền Thoại',
    genre: 'MOBA',
    riotProduct: 'league_of_legends',
    gameExe: ['LeagueClient.exe', 'Game\\League of Legends.exe']
  },
  {
    id: 'valorant',
    title: 'VALORANT',
    genre: 'FPS',
    riotProduct: 'valorant',
    // File khởi động nhỏ có icon VALORANT (exe game thật > 200 MB, chỉ đọc được icon 32px)
    gameExe: ['VALORANT.exe']
  },
  {
    id: 'counter-strike-2',
    title: 'Counter-Strike 2',
    genre: 'FPS',
    steamAppId: '730'
  },
  {
    id: 'delta-force',
    title: 'Delta Force',
    genre: 'FPS',
    steamAppId: '2507950',
    uninstall: {
      name: /^Delta Force\b/i,
      exe: ['launcher\\DeltaForceLauncher.exe', 'DeltaForceLauncher.exe', 'DeltaForce.exe']
    }
  },
  {
    id: 'genshin-impact',
    title: 'Genshin Impact',
    genre: 'Nhập vai',
    uninstall: {
      name: /^Genshin Impact\b/i,
      exe: ['launcher.exe', 'Genshin Impact Game\\GenshinImpact.exe'],
      gameDir: 'Genshin Impact Game'
    },
    hostLauncher: hoyoPlay(['games\\Genshin Impact game']),
    gameExe: ['GenshinImpact.exe', 'YuanShen.exe']
  },
  {
    id: 'honkai-star-rail',
    title: 'Honkai: Star Rail',
    genre: 'Nhập vai',
    uninstall: {
      name: /^(Honkai: )?Star Rail\b/i,
      exe: ['launcher.exe', 'Games\\StarRail.exe'],
      gameDir: 'Games'
    },
    hostLauncher: hoyoPlay(['games\\Star Rail Games', 'games\\Honkai Star Rail Game']),
    gameExe: ['StarRail.exe']
  },
  {
    id: 'zenless-zone-zero',
    title: 'Zenless Zone Zero',
    genre: 'Hành động',
    uninstall: {
      name: /^Zenless Zone Zero\b/i,
      exe: ['launcher.exe', 'ZenlessZoneZero Game\\ZenlessZoneZero.exe'],
      gameDir: 'ZenlessZoneZero Game'
    },
    hostLauncher: hoyoPlay(['games\\ZenlessZoneZero Game', 'games\\Zenless Zone Zero Game']),
    gameExe: ['ZenlessZoneZero.exe']
  },
  {
    id: 'wuthering-waves',
    title: 'Wuthering Waves',
    genre: 'Nhập vai',
    uninstall: {
      name: /^Wuthering Waves\b/i,
      exe: ['launcher.exe', 'Wuthering Waves Game\\Wuthering Waves.exe'],
      gameDir: 'Wuthering Waves Game'
    },
    gameExe: ['Wuthering Waves.exe']
  },
  {
    id: 'naraka-bladepoint',
    title: 'NARAKA: BLADEPOINT',
    genre: 'Hành động',
    steamAppId: '1203220',
    uninstall: {
      name: /^NARAKA\b/i,
      exe: ['NarakaLauncher.exe', 'launcher.exe', 'NarakaBladepoint.exe']
    }
  },
  {
    id: 'where-winds-meet',
    title: 'Where Winds Meet',
    genre: 'Nhập vai',
    steamAppId: '3564740',
    uninstall: {
      name: /^Where Winds Meet\b/i,
      exe: ['launcher.exe', 'wwm.exe', 'WhereWindsMeet.exe']
    }
  }
]
