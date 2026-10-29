import { FolderIcon, XIcon } from './Icons'

interface WatchDirSuggestionCardProps {
  suggestion: WatchDirSuggestion
  // true = dùng thư mục, false = bỏ qua (không hỏi lại thư mục này)
  onAnswer: (accept: boolean) => void
  onClose: () => void // Chỉ ẩn, lần mở game sau có thể hỏi lại
}

// Thông báo góc màn hình: launcher sinh ra exe ở thư mục lạ chạy lâu => có thể là game thật
export function WatchDirSuggestionCard({
  suggestion,
  onAnswer,
  onClose
}: WatchDirSuggestionCardProps): React.JSX.Element {
  return (
    <div className="dir-suggestion" role="dialog" aria-label="Gợi ý thư mục game">
      <button className="dir-suggestion-close" title="Để sau" onClick={onClose}>
        <XIcon width={14} height={14} />
      </button>
      <span className="dir-suggestion-icon">
        <FolderIcon width={18} height={18} />
      </span>
      <div className="dir-suggestion-body">
        <strong>Có vẻ {suggestion.title} chạy từ thư mục khác</strong>
        <p>
          <code>{suggestion.exeName}</code> do launcher mở đang chạy từ:
        </p>
        <span className="dir-suggestion-path" title={suggestion.dir}>
          {suggestion.dir}
        </span>
        <p>Dùng thư mục này làm thư mục game để chỉ tính giờ khi thực sự vào game?</p>
        <div className="dir-suggestion-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => onAnswer(false)}>
            Bỏ qua
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onAnswer(true)}>
            Dùng thư mục này
          </button>
        </div>
      </div>
    </div>
  )
}
