import { useState } from 'react'
import { createTrip } from '../api.js'

export default function Home({ navigate }) {
  const [name, setName] = useState('')
  const [members, setMembers] = useState(['', ''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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
    <main className="container">
      <header className="app-header">
        <h1>旅の立替精算</h1>
        <p className="muted">旅行を作成して共有URLを送れば、みんなのスマホから記録できます</p>
      </header>

      <form className="card" onSubmit={handleSubmit}>
        <h2>新しい旅行</h2>

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
          {submitting ? '作成中…' : '旅行を作成'}
        </button>
      </form>
    </main>
  )
}
