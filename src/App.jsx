import { useEffect, useState } from 'react'
import Home from './pages/Home.jsx'
import Trip from './pages/Trip.jsx'

// URL の形が UUID のときだけ旅行画面として扱う
const TRIP_PATH = /^\/trip\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i

export default function App() {
  const [path, setPath] = useState(window.location.pathname)

  // ブラウザの戻る・進むに追従する
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = (to) => {
    window.history.pushState(null, '', to)
    setPath(to)
    window.scrollTo(0, 0)
  }

  const match = path.match(TRIP_PATH)
  if (match) return <Trip tripId={match[1].toLowerCase()} navigate={navigate} />
  return <Home navigate={navigate} />
}
