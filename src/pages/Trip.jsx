import { useCallback, useEffect, useMemo, useState } from 'react'
import { addExpense, deleteExpense, getTrip, setRate } from '../api.js'
import { CURRENCIES, currencyLabel, formatAmount, formatYen, summarize, toJpy } from '../settle.js'

// 他のメンバーの追加を反映するための自動更新の間隔（ミリ秒）
const REFRESH_INTERVAL = 10000

export default function Trip({ tripId, navigate }) {
  const [trip, setTrip] = useState(null)
  const [status, setStatus] = useState('loading') // loading / ready / notfound / error
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      const data = await getTrip(tripId)
      if (!data) {
        setStatus('notfound')
        return
      }
      setTrip(data)
      setStatus('ready')
    } catch (err) {
      // 一度表示できていれば、更新失敗は画面を消さずにメッセージだけ出す
      setError(`読み込みに失敗しました：${err.message}`)
      setStatus((s) => (s === 'ready' ? s : 'error'))
    }
  }, [tripId])

  // 最初の読み込みと、画面が表示されている間の自動更新
  useEffect(() => {
    reload()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') reload()
    }, REFRESH_INTERVAL)
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload])

  if (status === 'loading') {
    return <main className="container"><p className="muted center">読み込み中…</p></main>
  }
  if (status === 'notfound' || status === 'error') {
    return (
      <main className="container">
        <div className="card">
          <h2>{status === 'notfound' ? '旅行が見つかりません' : '読み込みに失敗しました'}</h2>
          <p className="muted">
            {status === 'notfound' ? 'URLが正しいか確認してください。' : error}
          </p>
          <button className="primary" onClick={() => navigate('/')}>トップへ戻る</button>
        </div>
      </main>
    )
  }

  const run = async (action) => {
    setError('')
    try {
      await action()
      await reload()
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }

  return (
    <main className="container">
      <header className="app-header">
        <h1>{trip.name}</h1>
        <p className="muted">メンバー：{trip.members.join('、')}</p>
      </header>

      <ShareBox />

      {error && (
        <p className="error" role="alert">
          {error}
          <button className="link" onClick={() => setError('')}>閉じる</button>
        </p>
      )}

      <Summary trip={trip} />

      <ExpenseForm
        members={trip.members}
        onSubmit={(expense) => run(() => addExpense(tripId, expense))}
      />

      <RateSection
        trip={trip}
        onSave={(currency, rate) => run(() => setRate(tripId, currency, rate))}
      />

      <ExpenseList
        trip={trip}
        onDelete={(id) => run(() => deleteExpense(tripId, id))}
      />

      <p className="center">
        <button className="link" onClick={reload}>最新の状態に更新</button>
      </p>
    </main>
  )
}

// 共有URLの表示とコピー
function ShareBox() {
  const url = window.location.href
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // クリップボードAPIが使えない環境向けの予備の方法
      const area = document.createElement('textarea')
      area.value = url
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="card share">
      <h2>共有URL</h2>
      <p className="muted small">このURLを知っている人は誰でも記録を見て追加できます。メンバーにだけ送ってください。</p>
      <div className="share-url">{url}</div>
      <button className="primary" onClick={copy}>{copied ? 'コピーしました' : 'URLをコピー'}</button>
    </section>
  )
}

// 合計と精算結果
function Summary({ trip }) {
  const result = useMemo(() => summarize(trip), [trip])

  return (
    <section className="card">
      <h2>精算結果</h2>
      <div className="total">
        <span className="muted">合計（円換算）</span>
        <strong>{formatYen(result.totalJpy)}</strong>
      </div>

      {result.missingRates.length > 0 && (
        <p className="warning">
          {result.missingRates.join('、')} のレートが未入力のため、その支払いは計算に含まれていません。
        </p>
      )}

      {result.transfers.length === 0 ? (
        <p className="muted">精算は必要ありません</p>
      ) : (
        <ul className="transfers">
          {result.transfers.map((t, i) => (
            <li key={i}>
              <span><b>{t.from}</b> → <b>{t.to}</b></span>
              <strong>{formatYen(t.amount)}</strong>
            </li>
          ))}
        </ul>
      )}

      <details className="breakdown">
        <summary>メンバーごとの内訳</summary>
        <table>
          <thead>
            <tr><th>名前</th><th>払った額</th><th>負担額</th><th>差額</th></tr>
          </thead>
          <tbody>
            {trip.members.map((m) => (
              <tr key={m}>
                <td>{m}</td>
                <td>{formatYen(result.paid[m])}</td>
                <td>{formatYen(result.share[m])}</td>
                <td className={result.balance[m] >= 0 ? 'plus' : 'minus'}>
                  {result.balance[m] >= 0 ? '+' : ''}{formatYen(result.balance[m])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}

// 支払いの入力フォーム
function ExpenseForm({ members, onSubmit }) {
  const [payer, setPayer] = useState(members[0])
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('JPY')
  const [description, setDescription] = useState('')
  const [splitAmong, setSplitAmong] = useState(members)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const toggle = (m) => {
    setSplitAmong((list) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    // 全角数字やカンマも受け付ける
    const normalized = amount.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/,/g, '')
    const value = Number(normalized)
    if (!(value > 0)) return setError('金額を正しく入力してください')
    if (splitAmong.length === 0) return setError('割る人を1人以上選んでください')

    setSubmitting(true)
    const ok = await onSubmit({
      payer,
      amount: value,
      currency,
      description: description.trim(),
      // メンバーの並び順にそろえて送る
      splitAmong: members.filter((m) => splitAmong.includes(m)),
    })
    setSubmitting(false)
    if (ok) {
      setAmount('')
      setDescription('')
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>支払いを追加</h2>

      <label className="field">
        <span>払った人</span>
        <select value={payer} onChange={(e) => setPayer(e.target.value)}>
          {members.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>

      <div className="row">
        <label className="field grow">
          <span>金額</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </label>
        <label className="field">
          <span>通貨</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}（{c.label}）</option>)}
          </select>
        </label>
      </div>

      <label className="field">
        <span>内容</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例：夕食、タクシー"
          maxLength={200}
        />
      </label>

      <div className="field">
        <span>
          割る人
          <button type="button" className="link" onClick={() => setSplitAmong(members)}>全員</button>
        </span>
        <div className="chips">
          {members.map((m) => (
            <label key={m} className={`chip ${splitAmong.includes(m) ? 'on' : ''}`}>
              <input type="checkbox" checked={splitAmong.includes(m)} onChange={() => toggle(m)} />
              {m}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <button type="submit" className="primary" disabled={submitting}>
        {submitting ? '追加中…' : '追加する'}
      </button>
    </form>
  )
}

// 為替レートの入力（支払いに使われている外貨とレート登録済みの通貨を表示）
function RateSection({ trip, onSave }) {
  const codes = useMemo(() => {
    const set = new Set(Object.keys(trip.rates))
    for (const e of trip.expenses) if (e.currency !== 'JPY') set.add(e.currency)
    return [...set].sort()
  }, [trip])

  return (
    <section className="card">
      <h2>為替レート</h2>
      {codes.length === 0 ? (
        <p className="muted">外貨の支払いを追加すると、ここでレートを入力できます</p>
      ) : (
        <>
          <p className="muted small">1単位あたり何円かを入力してください（入力欄から離れると保存されます）</p>
          {codes.map((code) => (
            <RateInput key={code} code={code} saved={trip.rates[code]} onSave={onSave} />
          ))}
        </>
      )}
    </section>
  )
}

function RateInput({ code, saved, onSave }) {
  const savedText = saved == null ? '' : String(saved)
  const [value, setValue] = useState(savedText)
  const [editing, setEditing] = useState(false)

  // 編集中でなければ、他の人が保存したレートを反映する
  useEffect(() => {
    if (!editing) setValue(savedText)
  }, [savedText, editing])

  const save = async () => {
    setEditing(false)
    const text = value.trim()
    if (text === savedText) return
    if (text === '') return onSave(code, null)
    const rate = Number(text)
    if (!(rate > 0)) {
      setValue(savedText)
      return
    }
    await onSave(code, rate)
  }

  return (
    <label className="rate-row">
      <span>1 {code}（{currencyLabel(code)}）=</span>
      <input
        inputMode="decimal"
        value={value}
        onFocus={() => setEditing(true)}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        placeholder="未入力"
      />
      <span>円</span>
    </label>
  )
}

// 支払いの一覧
function ExpenseList({ trip, onDelete }) {
  const handleDelete = (e) => {
    const label = e.description || '（内容なし）'
    if (window.confirm(`「${label}」${formatAmount(e.amount, e.currency)} を削除しますか？`)) {
      onDelete(e.id)
    }
  }

  return (
    <section className="card">
      <h2>支払い一覧（{trip.expenses.length}件）</h2>
      {trip.expenses.length === 0 ? (
        <p className="muted">まだ支払いがありません</p>
      ) : (
        <ul className="expenses">
          {trip.expenses.map((e) => {
            const jpy = toJpy(e, trip.rates)
            const everyone = e.split_among.length === trip.members.length
            return (
              <li key={e.id}>
                <div className="expense-main">
                  <div className="expense-title">{e.description || '（内容なし）'}</div>
                  <div className="muted small">
                    {e.payer} が支払い ／ {everyone ? '全員' : e.split_among.join('、')}で割る
                  </div>
                </div>
                <div className="expense-amount">
                  <div>{formatAmount(e.amount, e.currency)}</div>
                  {e.currency !== 'JPY' && (
                    <div className="muted small">{jpy === null ? 'レート未入力' : `≈ ${formatYen(jpy)}`}</div>
                  )}
                </div>
                <button className="icon-button" onClick={() => handleDelete(e)} aria-label="削除">×</button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
