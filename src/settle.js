// 選べる通貨（rate は「1単位 = 何円か」で入力してもらう）
export const CURRENCIES = [
  { code: 'JPY', label: '日本円' },
  { code: 'USD', label: '米ドル' },
  { code: 'EUR', label: 'ユーロ' },
  { code: 'KRW', label: '韓国ウォン' },
  { code: 'TWD', label: '台湾ドル' },
  { code: 'CNY', label: '人民元' },
  { code: 'HKD', label: '香港ドル' },
  { code: 'THB', label: 'タイバーツ' },
  { code: 'SGD', label: 'シンガポールドル' },
  { code: 'VND', label: 'ベトナムドン' },
  { code: 'PHP', label: 'フィリピンペソ' },
  { code: 'GBP', label: '英ポンド' },
  { code: 'AUD', label: '豪ドル' },
]

export function currencyLabel(code) {
  return CURRENCIES.find((c) => c.code === code)?.label ?? code
}

// 支払い1件を円に換算する。レート未入力なら null
export function toJpy(expense, rates) {
  const amount = Number(expense.amount)
  if (expense.currency === 'JPY') return amount
  const rate = Number(rates?.[expense.currency])
  return rate > 0 ? amount * rate : null
}

// 小数を使わない通貨（それ以外は小数第2位まで）
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND'])

export function decimalsOf(currency) {
  return ZERO_DECIMAL.has(currency) ? 0 : 2
}

// 支払い1件の「誰がいくら負担するか」（支払いと同じ通貨）
// 金額指定ならその内訳、なければ割る人で均等に割る
export function sharesOf(expense) {
  if (expense.shares) {
    return Object.fromEntries(Object.entries(expense.shares).map(([m, v]) => [m, Number(v)]))
  }
  const each = Number(expense.amount) / expense.split_among.length
  return Object.fromEntries(expense.split_among.map((m) => [m, each]))
}

// 残りの金額を人数で割り、端数は先頭の人から1単位ずつ足して合計をぴったりにする
export function splitEvenly(total, count, currency) {
  const unit = 10 ** decimalsOf(currency)
  const totalUnits = Math.round(total * unit)
  const base = Math.floor(totalUnits / count)
  const extra = totalUnits - base * count
  return Array.from({ length: count }, (_, i) => (base + (i < extra ? 1 : 0)) / unit)
}

// 合計・各メンバーの収支・精算方法をまとめて計算する
export function summarize(trip) {
  const balance = {} // プラス＝受け取る側、マイナス＝払う側
  const paid = {}
  const share = {}
  for (const m of trip.members) {
    balance[m] = 0
    paid[m] = 0
    share[m] = 0
  }

  let totalJpy = 0
  const missingRates = new Set()

  for (const e of trip.expenses) {
    const jpy = toJpy(e, trip.rates)
    if (jpy === null) {
      missingRates.add(e.currency)
      continue
    }
    totalJpy += jpy
    paid[e.payer] = (paid[e.payer] ?? 0) + jpy
    balance[e.payer] = (balance[e.payer] ?? 0) + jpy
    for (const [m, part] of Object.entries(sharesOf(e))) {
      const partJpy = (jpy * part) / Number(e.amount)
      share[m] = (share[m] ?? 0) + partJpy
      balance[m] = (balance[m] ?? 0) - partJpy
    }
  }

  return { totalJpy, paid, share, balance, transfers: settle(balance), missingRates: [...missingRates] }
}

// 受け渡し回数がなるべく少なくなるよう、
// 一番多く受け取る人と一番多く払う人を順に組み合わせていく
function settle(balance) {
  const creditors = []
  const debtors = []
  for (const [name, b] of Object.entries(balance)) {
    if (b > 0.5) creditors.push({ name, amount: b })
    else if (b < -0.5) debtors.push({ name, amount: -b })
  }
  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const transfers = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount)
    const rounded = Math.round(amount)
    if (rounded > 0) {
      transfers.push({ from: debtors[i].name, to: creditors[j].name, amount: rounded })
    }
    debtors[i].amount -= amount
    creditors[j].amount -= amount
    if (debtors[i].amount < 0.5) i++
    if (creditors[j].amount < 0.5) j++
  }
  return transfers
}

export function formatYen(n) {
  return `${Math.round(n).toLocaleString('ja-JP')}円`
}

// メッセージアプリに貼り付ける用の精算結果の文章
export function settlementText(trip, result, url) {
  const lines = [`【${trip.name}】精算結果`, `合計：${formatYen(result.totalJpy)}`, '']
  if (result.transfers.length === 0) {
    lines.push('精算は必要ありません')
  } else {
    for (const t of result.transfers) lines.push(`${t.from} → ${t.to}：${formatYen(t.amount)}`)
  }
  if (result.missingRates.length > 0) {
    lines.push('', `※${result.missingRates.join('、')} のレートが未入力のため、その支払いは含まれていません`)
  }
  lines.push('', `詳細はこちら：${url}`)
  return lines.join('\n')
}

export function formatAmount(amount, currency) {
  const n = Number(amount).toLocaleString('ja-JP', { maximumFractionDigits: 2 })
  return currency === 'JPY' ? `${n}円` : `${n} ${currency}`
}
