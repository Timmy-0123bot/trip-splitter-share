// この端末で開いた旅行の一覧（ブラウザ内にだけ保存。データベースには送らない）
const KEY = 'trip-splitter-share.recent'
const MAX = 10

export function loadRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    // プライベートブラウズなどで使えない場合は空として扱う
    return []
  }
}

function saveList(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // 保存できなくてもアプリの動作には影響させない
  }
}

// 開いた旅行を先頭に追加する（同じ旅行は1件にまとめる）
export function rememberTrip(trip) {
  const list = loadRecent().filter((t) => t.id !== trip.id)
  list.unshift({ id: trip.id, name: trip.name, members: trip.members, openedAt: Date.now() })
  saveList(list.slice(0, MAX))
}

export function forgetTrip(id) {
  const list = loadRecent().filter((t) => t.id !== id)
  saveList(list)
  return list
}
