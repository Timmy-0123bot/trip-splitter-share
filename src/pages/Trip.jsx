import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addExpense,
  addMember,
  deleteExpense,
  getTrip,
  removeMember,
  renameMember,
  setRate,
  updateExpense,
} from '../api.js'
import { forgetTrip, rememberTrip } from '../recent.js'
import {
  CURRENCIES,
  currencyLabel,
  decimalsOf,
  formatAmount,
  formatYen,
  settlementText,
  splitEvenly,
  summarize,
  toJpy,
} from '../settle.js'
import { Avatar, PlaneIcon, SectionTitle, expenseCategory } from '../ui.jsx'

// 他のメンバーの追加を反映するための自動更新の間隔（ミリ秒）
const REFRESH_INTERVAL = 10000

export default function Trip({ tripId, navigate }) {
  const [trip, setTrip] = useState(null)
  const [status, setStatus] = useState('loading') // loading / ready / notfound / error
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // 編集中の支払い（null なら新規追加）

  const reload = useCallback(async () => {
    try {
      const data = await getTrip(tripId)
      if (!data) {
        // 削除された旅行は「最近開いた旅行」からも外す
        forgetTrip(tripId)
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

  // 「最近開いた旅行」に記録する（旅行名やメンバーが変わったときも更新）
  const recentKey = trip ? `${trip.id}\n${trip.name}\n${trip.members.join('\n')}` : ''
  useEffect(() => {
    if (trip) rememberTrip(trip)
  }, [recentKey])

  // 編集を始めたら入力フォームまでスクロールする
  useEffect(() => {
    if (editing) document.getElementById('expense-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editing])

  if (status === 'loading') {
    return (
      <main className="container">
        <p className="muted center loading">読み込み中…</p>
      </main>
    )
  }
  if (status === 'notfound' || status === 'error') {
    return (
      <main className="container">
        <div className="card center">
          <p className="section-en">NOT FOUND</p>
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

  const saveExpense = async (expense) => {
    const ok = await run(() =>
      editing ? updateExpense(tripId, editing.id, expense) : addExpense(tripId, expense),
    )
    if (ok) setEditing(null)
    return ok
  }

  return (
    <>
      <TripHeader trip={trip} navigate={navigate} />

      <main className="container">
        {error && (
          <p className="error" role="alert">
            {error}
            <button className="link" onClick={() => setError('')}>閉じる</button>
          </p>
        )}

        <ShareBox />

        <Summary trip={trip} />

        <ExpenseForm
          key={editing ? editing.id : 'new'}
          members={trip.members}
          initial={editing}
          onSubmit={saveExpense}
          onCancel={() => setEditing(null)}
        />

        <ExpenseList
          trip={trip}
          editingId={editing?.id}
          onEdit={setEditing}
          onDelete={async (id) => {
            if (editing?.id === id) setEditing(null)
            await run(() => deleteExpense(tripId, id))
          }}
        />

        <RateSection
          trip={trip}
          onSave={(currency, rate) => run(() => setRate(tripId, currency, rate))}
        />

        <MemberSection
          trip={trip}
          onAdd={(name) => run(() => addMember(tripId, name))}
          onRename={(oldName, newName) => run(() => renameMember(tripId, oldName, newName))}
          onRemove={(name) => run(() => removeMember(tripId, name))}
        />

        <p className="center">
          <button className="link" onClick={reload}>最新の状態に更新</button>
        </p>
      </main>
    </>
  )
}

// 画面上部：旅行名とメンバー
function TripHeader({ trip, navigate }) {
  return (
    <header className="hero hero-trip">
      <div className="hero-inner">
        <button className="hero-back" onClick={() => navigate('/')}>← トップ</button>
        <p className="hero-label">
          <span>BOARDING PASS</span>
          <span>{trip.members.length} PAX</span>
        </p>
        <h1>{trip.name}</h1>
        <div className="hero-members">
          {trip.members.map((m) => (
            <span key={m} className="hero-member">
              <Avatar name={m} members={trip.members} size={26} />
              {m}
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}

// 文字列をクリップボードにコピーする
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // クリップボードAPIが使えない環境向けの予備の方法
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
}

// コピーボタン（押すと2秒間「コピーしました」と表示）
function CopyButton({ getText, label, className = 'primary' }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await copyText(getText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return <button className={className} onClick={copy}>{copied ? 'コピーしました' : label}</button>
}

// 共有URLの表示とコピー
function ShareBox() {
  const url = window.location.href

  return (
    <section className="card share">
      <SectionTitle en="SHARE">共有URL</SectionTitle>
      <p className="muted small">このURLを知っている人は誰でも記録を見て追加できます。メンバーにだけ送ってください。</p>
      <div className="share-url">{url}</div>
      <CopyButton getText={() => url} label="URLをコピー" className="secondary full" />
    </section>
  )
}

// 合計と精算結果（搭乗券ふうのカード）
function Summary({ trip }) {
  const result = useMemo(() => summarize(trip), [trip])

  return (
    <section className="card ticket ticket-dark">
      <div className="ticket-band">
        <span>SETTLEMENT</span>
        <span>精算</span>
      </div>
      <div className="ticket-body">
        <p className="ticket-label">TOTAL・合計（円換算）</p>
        <strong className="total-amount">{formatYen(result.totalJpy)}</strong>
        <dl className="ticket-stats">
          <div><dt>EXPENSES</dt><dd>{trip.expenses.length}件</dd></div>
          <div><dt>PAX</dt><dd>{trip.members.length}人</dd></div>
          <div><dt>TRANSFERS</dt><dd>{result.transfers.length}回</dd></div>
        </dl>
      </div>

      <div className="ticket-perforation" aria-hidden="true" />

      <div className="ticket-body">
        {result.missingRates.length > 0 && (
          <p className="warning">
            {result.missingRates.join('、')} のレートが未入力のため、その支払いは計算に含まれていません。
          </p>
        )}

        {result.transfers.length === 0 ? (
          <p className="ticket-empty">精算は必要ありません</p>
        ) : (
          <ul className="transfers">
            {result.transfers.map((t, i) => (
              <li key={i}>
                <div className="leg">
                  <span className="leg-label">FROM</span>
                  <span className="leg-name">
                    <Avatar name={t.from} members={trip.members} size={24} />
                    {t.from}
                  </span>
                </div>
                <span className="leg-line" aria-label="から">
                  <PlaneIcon size={14} />
                </span>
                <div className="leg leg-to">
                  <span className="leg-label">TO</span>
                  <span className="leg-name">
                    <Avatar name={t.to} members={trip.members} size={24} />
                    {t.to}
                  </span>
                </div>
                <strong className="transfer-amount">{formatYen(t.amount)}</strong>
              </li>
            ))}
          </ul>
        )}

        <CopyButton
          getText={() => settlementText(trip, result, window.location.href)}
          label="精算結果をコピー（LINEなどに貼り付け用）"
        />

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
      </div>
    </section>
  )
}

// 入力された金額を数値にする（全角数字やカンマも受け付ける）。空欄は null、不正な値は NaN
function parseAmount(text) {
  const normalized = text
    .replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，]/g, '')
    .trim()
  return normalized === '' ? null : Number(normalized)
}

// 小数第2位までの比較用に整数にする
const toCents = (n) => Math.round(n * 100)

// 支払いの入力フォーム（initial を渡すと編集モード）
function ExpenseForm({ members, initial, onSubmit, onCancel }) {
  const [payer, setPayer] = useState(initial?.payer ?? members[0])
  const [amount, setAmount] = useState(initial ? String(Number(initial.amount)) : '')
  const [currency, setCurrency] = useState(initial?.currency ?? 'JPY')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [mode, setMode] = useState(initial?.shares ? 'custom' : 'equal') // equal：均等に割る / custom：金額を指定
  const [splitAmong, setSplitAmong] = useState(initial && !initial.shares ? initial.split_among : members)
  // 金額指定の入力値（メンバー名 → 文字列）
  const [custom, setCustom] = useState(() =>
    initial?.shares ? Object.fromEntries(Object.entries(initial.shares).map(([m, v]) => [m, String(Number(v))])) : {},
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // メンバーが追加・変更されたら選択状態を合わせる
  // （それまで全員を選んでいたなら、新しいメンバーも割る人に入れる）
  const prevMembers = useRef(members)
  const membersKey = members.join('\n')
  useEffect(() => {
    const prev = prevMembers.current
    prevMembers.current = members
    setPayer((p) => (members.includes(p) ? p : members[0]))
    setSplitAmong((list) => {
      if (prev.every((m) => list.includes(m))) return members
      const kept = list.filter((m) => members.includes(m))
      return kept.length > 0 ? kept : members
    })
  }, [membersKey])

  const toggle = (m) => {
    setSplitAmong((list) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]))
  }

  // 金額指定の合計と残り（表示用）
  const total = parseAmount(amount)
  const customSum = members.reduce((sum, m) => {
    const v = parseAmount(custom[m] ?? '')
    return v > 0 ? sum + v : sum
  }, 0)
  const remaining = total > 0 ? total - customSum : null

  // 未入力の人で残りを均等に割って埋める
  const fillRemaining = () => {
    setError('')
    if (!(total > 0)) return setError('先に金額を入力してください')
    const blanks = members.filter((m) => parseAmount(custom[m] ?? '') === null)
    if (blanks.length === 0) return setError('未入力の人がいません')
    if (toCents(remaining) <= 0) return setError('残りの金額がありません')
    const parts = splitEvenly(remaining, blanks.length, currency)
    setCustom((c) => ({ ...c, ...Object.fromEntries(blanks.map((m, i) => [m, String(parts[i])])) }))
  }

  // 入力内容から送信する割り方を作る。問題があればエラー文を返す
  const buildSplit = (value) => {
    if (mode === 'equal') {
      const selected = members.filter((m) => splitAmong.includes(m))
      if (selected.length === 0) return { error: '割る人を1人以上選んでください' }
      // メンバーの並び順にそろえて送る
      return { splitAmong: selected }
    }
    const shares = {}
    for (const m of members) {
      const v = parseAmount(custom[m] ?? '')
      if (v === null || v === 0) continue
      if (!(v > 0)) return { error: `${m} の金額を正しく入力してください` }
      shares[m] = Math.round(v * 100) / 100
    }
    const names = Object.keys(shares)
    if (names.length === 0) return { error: '負担する人の金額を入力してください' }
    const diff = toCents(value) - names.reduce((sum, m) => sum + toCents(shares[m]), 0)
    if (diff !== 0) {
      return { error: `内訳の合計が金額と合いません（${diff > 0 ? 'あと' : ''}${formatAmount(Math.abs(diff) / 100, currency)}${diff > 0 ? '' : '多い'}）` }
    }
    return { splitAmong: names, shares }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const value = parseAmount(amount)
    if (!(value > 0)) return setError('金額を正しく入力してください')
    const split = buildSplit(value)
    if (split.error) return setError(split.error)

    setSubmitting(true)
    const ok = await onSubmit({
      payer,
      amount: value,
      currency,
      description: description.trim(),
      splitAmong: split.splitAmong,
      shares: split.shares,
    })
    setSubmitting(false)
    if (ok && !initial) {
      setAmount('')
      setDescription('')
      setCustom({})
    }
  }

  return (
    <form id="expense-form" className={`card ${initial ? 'editing' : ''}`} onSubmit={handleSubmit}>
      <SectionTitle en={initial ? 'EDIT EXPENSE' : 'NEW EXPENSE'}>{initial ? '支払いを編集' : '支払いを追加'}</SectionTitle>

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
        <span>割り方</span>
        <div className="segmented">
          <button type="button" className={mode === 'equal' ? 'on' : ''} onClick={() => setMode('equal')}>
            均等に割る
          </button>
          <button type="button" className={mode === 'custom' ? 'on' : ''} onClick={() => setMode('custom')}>
            金額を指定
          </button>
        </div>
      </div>

      {mode === 'equal' ? (
        <div className="field">
          <span>
            割る人
            <button type="button" className="link" onClick={() => setSplitAmong(members)}>全員</button>
          </span>
          <div className="chips">
            {members.map((m) => (
              <label key={m} className={`chip ${splitAmong.includes(m) ? 'on' : ''}`}>
                <input type="checkbox" checked={splitAmong.includes(m)} onChange={() => toggle(m)} />
                <Avatar name={m} members={members} size={22} />
                {m}
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="field">
          <span>それぞれの負担額（{currency}）</span>
          <p className="muted small">負担しない人は空欄か0のままにしてください</p>
          {members.map((m) => (
            <label key={m} className="rate-row">
              <Avatar name={m} members={members} size={26} />
              <span className="share-name">{m}</span>
              <input
                inputMode="decimal"
                value={custom[m] ?? ''}
                onChange={(e) => setCustom((c) => ({ ...c, [m]: e.target.value }))}
                placeholder="0"
              />
            </label>
          ))}
          {remaining !== null && (
            <p className={`small ${toCents(remaining) === 0 ? 'muted' : 'warning'}`}>
              {toCents(remaining) === 0
                ? '✓ 内訳の合計が金額と一致しています'
                : toCents(remaining) > 0
                  ? `残り ${formatAmount(remaining.toFixed(decimalsOf(currency)), currency)}`
                  : `${formatAmount((-remaining).toFixed(decimalsOf(currency)), currency)} 多すぎます`}
            </p>
          )}
          <button type="button" className="secondary" onClick={fillRemaining}>
            残りを未入力の人で均等に割る
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <button type="submit" className="primary" disabled={submitting}>
        {submitting ? '保存中…' : initial ? '変更を保存' : '追加する'}
      </button>
      {initial && (
        <button type="button" className="ghost full" onClick={onCancel} disabled={submitting}>
          編集をやめる
        </button>
      )}
    </form>
  )
}

// 支払いの一覧
function ExpenseList({ trip, editingId, onEdit, onDelete }) {
  const handleDelete = (e) => {
    const label = e.description || '（内容なし）'
    if (window.confirm(`「${label}」${formatAmount(e.amount, e.currency)} を削除しますか？`)) {
      onDelete(e.id)
    }
  }

  return (
    <section className="card">
      <SectionTitle en="EXPENSES">支払い一覧（{trip.expenses.length}件）</SectionTitle>
      {trip.expenses.length === 0 ? (
        <p className="muted center">まだ支払いがありません</p>
      ) : (
        <ul className="expenses">
          {trip.expenses.map((e) => {
            const jpy = toJpy(e, trip.rates)
            const everyone = e.split_among.length === trip.members.length
            const category = expenseCategory(e.description)
            return (
              <li key={e.id} className={editingId === e.id ? 'is-editing' : ''}>
                <span className="expense-code" title={category.label}>{category.code}</span>
                <div className="expense-main">
                  <div className="expense-title">{e.description || '（内容なし）'}</div>
                  <div className="muted small">
                    {e.payer} が支払い ／ {e.shares
                      ? `内訳：${trip.members
                          .filter((m) => e.shares[m] != null)
                          .map((m) => `${m} ${formatAmount(e.shares[m], e.currency)}`)
                          .join('、')}`
                      : `${everyone ? '全員' : e.split_among.join('、')}で割る`}
                  </div>
                  <div className="expense-actions">
                    <button className="link" onClick={() => onEdit(e)}>編集</button>
                    <button className="link danger" onClick={() => handleDelete(e)}>削除</button>
                  </div>
                </div>
                <div className="expense-amount">
                  <div>{formatAmount(e.amount, e.currency)}</div>
                  {e.currency !== 'JPY' && (
                    <div className="muted small">{jpy === null ? 'レート未入力' : `≈ ${formatYen(jpy)}`}</div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
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
      <SectionTitle en="EXCHANGE RATE">為替レート</SectionTitle>
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

// メンバーの追加・名前変更・削除
function MemberSection({ trip, onAdd, onRename, onRemove }) {
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState(null) // 名前を変更中のメンバー
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  // 支払いに関わっているメンバー（削除できない）
  const used = useMemo(() => new Set(trip.expenses.flatMap((e) => [e.payer, ...e.split_among])), [trip])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setBusy(true)
    if (await onAdd(newName.trim())) setNewName('')
    setBusy(false)
  }

  const startRename = (m) => {
    setRenaming(m)
    setDraft(m)
  }

  const handleRename = async (e) => {
    e.preventDefault()
    const name = draft.trim()
    if (!name || name === renaming) return setRenaming(null)
    setBusy(true)
    if (await onRename(renaming, name)) setRenaming(null)
    setBusy(false)
  }

  const handleRemove = async (m) => {
    if (!window.confirm(`${m} をメンバーから外しますか？`)) return
    setBusy(true)
    await onRemove(m)
    setBusy(false)
  }

  return (
    <section className="card">
      <SectionTitle en="PASSENGERS">メンバー（{trip.members.length}人）</SectionTitle>
      <ul className="members">
        {trip.members.map((m) => (
          <li key={m}>
            {renaming === m ? (
              <form className="row grow" onSubmit={handleRename}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={30} autoFocus />
                <button type="submit" className="secondary" disabled={busy}>保存</button>
                <button type="button" className="ghost" onClick={() => setRenaming(null)} disabled={busy}>やめる</button>
              </form>
            ) : (
              <>
                <Avatar name={m} members={trip.members} />
                <span className="member-name">{m}</span>
                <button className="link" onClick={() => startRename(m)} disabled={busy}>名前を変更</button>
                {!used.has(m) && trip.members.length > 1 && (
                  <button className="link danger" onClick={() => handleRemove(m)} disabled={busy}>外す</button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="muted small">名前を変えると、過去の支払いの名前も変わります。支払いに関わっている人は外せません。</p>
      <form className="row" onSubmit={handleAdd}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="追加するメンバーの名前"
          maxLength={30}
        />
        <button type="submit" className="secondary" disabled={busy || !newName.trim()}>追加</button>
      </form>
    </section>
  )
}
