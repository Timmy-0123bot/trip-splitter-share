import { useState } from 'react'
import { createTrip } from '../api.js'
import { forgetTrip, loadRecent } from '../recent.js'

export default function Home({ navigate }) {
  const [name, setName] = useState('')
  const [members, setMembers] = useState(['', ''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [recent, setRecent] = useState(loadRecent)

  const updateMember = (index, value) => {
    setMembers((list) => list.map((m, i) => (i === index ? value : m)))
  }
  const removeMember = (index) => {
    setMembers((list) => list.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const trimmed = members.map((m) => m.trim()).filter(Boolean)
    if (!name.trim()) return setError('旅行名を入力してください')
    if (trimmed.length === 0) return setError('メンバーを1人以上入力してください')
    if (new Set(trimmed).size !== trimmed.length) return setError('同じ名前のメンバーがいます')

    setSubmitting(true)
    try {
      const id = await createTrip(name.trim(), trimmed)
      navigate(`/trip/${id}`)
    } catch (err) {
      setError(`作成できませんでした：${err.message}`)
      setSubmitting(false)
    }
  }

  return (
    <>
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-emoji" aria-hidden="true">🧳 ✈️ 🏝️</div>
          <h1>旅の立替精算</h1>
          <p>みんなのスマホで記録して、帰ったらすぐ精算。</p>
        </div>
        <div className="hero-wave" aria-hidden="true" />
      </header>

      <main className="container">
        {recent.length > 0 && (
          <section className="card">
            <div className="section-title">
              <span className="section-icon" aria-hidden="true">🗺️</span>
              <h2>最近開いた旅行</h2>
            </div>
            <p className="muted small">このスマホで開いたことのある旅行です</p>
            <ul className="recent-list">
              {recent.map((t) => (
                <li key={t.id}>
                  <button type="button" className="recent-item" onClick={() => navigate(`/trip/${t.id}`)}>
                    <span className="recent-name">{t.name}</span>
                    <span className="muted small">
                      {(t.members ?? []).join('・')}
                      {t.openedAt ? `　${new Date(t.openedAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}に表示` : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setRecent(forgetTrip(t.id))}
                    aria-label={`${t.name}を一覧から外す`}
                    title="一覧から外す（旅行のデータは消えません）"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <form className="card ticket" onSubmit={handleSubmit}>
          <div className="ticket-band">
            <span>NEW TRIP</span>
            <span aria-hidden="true">✈</span>
          </div>
          <div className="ticket-body">
            <h2>新しい旅をはじめる</h2>

            <label className="field">
              <span>旅行名</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：ソウル旅行 2026"
                maxLength={100}
              />
            </label>

            <div className="field">
              <span>メンバー</span>
              {members.map((m, i) => (
                <div className="row" key={i}>
                  <input
                    value={m}
                    onChange={(e) => updateMember(i, e.target.value)}
                    placeholder={`メンバー${i + 1}`}
                    maxLength={30}
                  />
                  {members.length > 1 && (
                    <button type="button" className="icon-button" onClick={() => removeMember(i)} aria-label="削除">
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="secondary" onClick={() => setMembers((l) => [...l, ''])}>
                ＋ メンバーを追加
              </button>
            </div>

            {error && <p className="error">{error}</p>}

            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? '作成中…' : '旅行を作成 🛫'}
            </button>
            <p className="muted small center">メンバーはあとから追加・変更もできます</p>
          </div>
        </form>
      </main>
    </>
  )
}
