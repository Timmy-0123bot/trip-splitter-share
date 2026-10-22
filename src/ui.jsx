// 画面で共通して使う小さな部品

// メンバーごとのアイコンの色（メンバーの並び順で決める）
const AVATAR_COLORS = ['#ff8a5b', '#2bb3c0', '#f7b538', '#7c6cf2', '#ef5d8f', '#4caf7d', '#3d8bfd', '#c27b52']

export function Avatar({ name, members, size = 32 }) {
  const index = Math.max(0, members.indexOf(name))
  return (
    <span
      className="avatar"
      style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length], width: size, height: size, fontSize: size * 0.45 }}
      aria-hidden="true"
    >
      {Array.from(name)[0] ?? '?'}
    </span>
  )
}

// 支払いの内容から、それらしい絵文字を選ぶ
const ICON_RULES = [
  [/タクシー|電車|バス|新幹線|地下鉄|メトロ|交通|ガソリン|駐車|高速|レンタカー|切符|フェリー/, '🚕'],
  [/飛行機|航空|フライト|空港/, '✈️'],
  [/ホテル|宿|旅館|民泊|ゲストハウス|ホステル/, '🏨'],
  [/カフェ|コーヒー|スタバ|ドリンク|ジュース|お茶/, '☕'],
  [/酒|ビール|ワイン|居酒屋|バー|飲み/, '🍻'],
  [/朝食|昼食|夕食|ランチ|ディナー|ご飯|ごはん|食事|レストラン|焼肉|寿司|ラーメン|屋台|食べ/, '🍽️'],
  [/コンビニ|スーパー|おやつ|お菓子|水/, '🛒'],
  [/お土産|おみやげ|土産|買い物|ショッピング/, '🎁'],
  [/チケット|入場|入館|観光|ツアー|美術館|博物館|テーマパーク|体験/, '🎟️'],
  [/温泉|スパ|マッサージ|エステ/, '♨️'],
]

export function expenseIcon(description) {
  for (const [pattern, icon] of ICON_RULES) {
    if (pattern.test(description ?? '')) return icon
  }
  return '🧾'
}

// カードの見出し（絵文字つき）
export function SectionTitle({ icon, children, extra }) {
  return (
    <div className="section-title">
      <span className="section-icon" aria-hidden="true">{icon}</span>
      <h2>{children}</h2>
      {extra}
    </div>
  )
}
