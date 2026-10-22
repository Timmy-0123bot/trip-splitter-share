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
    const each = jpy / e.split_among.length
    for (const m of e.split_among) {
      share[m] = (share[m] ?? 0) + each
      balance[m] = (balance[m] ?? 0) - each
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

export function formatAmount(amount, currency) {
  const n = Number(amount).toLocaleString('ja-JP', { maximumFractionDigits: 2 })
  return currency === 'JPY' ? `${n}円` : `${n} ${currency}`
}
