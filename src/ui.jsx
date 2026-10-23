// 画面で共通して使う小さな部品

// メンバーごとのアイコンの色（メンバーの並び順で決める。落ち着いたトーン）
const AVATAR_COLORS = ['#d4943a', '#2a9d8f', '#5b7db1', '#c0675a', '#8a6fb0', '#4f8a5b', '#a7834a', '#3f6f8f']

export function Avatar({ name, members, size = 32 }) {
  const index = Math.max(0, members.indexOf(name))
  return (
    <span
      className="avatar"
      style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length], width: size, height: size, fontSize: size * 0.44 }}
      aria-hidden="true"
    >
      {Array.from(name)[0] ?? '?'}
    </span>
  )
}

// 支払いの内容から、空港コード風の3文字の分類を選ぶ
const CATEGORY_RULES = [
  [/飛行機|航空|フライト|空港/, 'FLT', '航空'],
  [/タクシー|電車|バス|新幹線|地下鉄|メトロ|交通|ガソリン|駐車|高速|レンタカー|切符|フェリー/, 'TRN', '交通'],
  [/ホテル|宿|旅館|民泊|ゲストハウス|ホステル/, 'HTL', '宿泊'],
  [/カフェ|コーヒー|スタバ|ドリンク|ジュース|お茶/, 'CAF', 'カフェ'],
  [/酒|ビール|ワイン|居酒屋|バー|飲み/, 'BAR', 'お酒'],
  [/朝食|昼食|夕食|ランチ|ディナー|ご飯|ごはん|食事|レストラン|焼肉|寿司|ラーメン|屋台|食べ/, 'DIN', '食事'],
  [/コンビニ|スーパー|おやつ|お菓子|水/, 'MKT', '買い出し'],
  [/お土産|おみやげ|土産|買い物|ショッピング/, 'SHP', '買い物'],
  [/チケット|入場|入館|観光|ツアー|美術館|博物館|テーマパーク|体験/, 'TIX', '観光'],
  [/温泉|スパ|マッサージ|エステ/, 'SPA', 'スパ'],
]

export function expenseCategory(description) {
  for (const [pattern, code, label] of CATEGORY_RULES) {
    if (pattern.test(description ?? '')) return { code, label }
  }
  return { code: 'EXP', label: 'その他' }
}

// カードの見出し（英字の小見出し＋日本語の見出し）
export function SectionTitle({ en, children, extra }) {
  return (
    <div className="section-title">
      <div className="section-heading">
        <p className="section-en">{en}</p>
        <h2>{children}</h2>
      </div>
      {extra}
    </div>
  )
}

// 飛行機のアイコン（線画）
export function PlaneIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  )
}
