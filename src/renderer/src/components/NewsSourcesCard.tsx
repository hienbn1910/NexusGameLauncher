import { useEffect, useState } from 'react'

// Bật/tắt các trang báo game cho tab "Tin game"
export function NewsSourcesCard(): React.JSX.Element {
  const api = window.electronAPI.news
  const [sites, setSites] = useState<NewsSite[]>([])

  useEffect(() => {
    api.getSites().then(setSites)
  }, [api])

  return (
    <div className="news-sources">
      {sites.map((site) => (
        <label key={site.id} className="news-source">
          <input
            type="checkbox"
            checked={site.enabled}
            onChange={(e) => api.setSiteEnabled(site.id, e.target.checked).then(setSites)}
          />
          <span className="news-source-name">{site.name}</span>
          <span className="news-lang">{site.lang.toUpperCase()}</span>
        </label>
      ))}
    </div>
  )
}
