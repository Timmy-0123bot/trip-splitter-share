import { supabase } from './supabase.js'

// データベース関数を呼び出し、エラーなら例外にする
async function call(fn, args) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data
}

export function createTrip(name, members) {
  return call('create_trip', { p_name: name, p_members: members })
}

// 旅行が見つからないときは null が返る
export function getTrip(tripId) {
  return call('get_trip', { p_trip_id: tripId })
}

// shares（金額指定の内訳）は均等割りのときは送らない
export function addExpense(tripId, { payer, amount, currency, description, splitAmong, shares }) {
  const args = {
    p_trip_id: tripId,
    p_payer: payer,
    p_amount: amount,
    p_currency: currency,
    p_description: description,
    p_split_among: splitAmong,
  }
  if (shares) args.p_shares = shares
  return call('add_expense', args)
}

export function deleteExpense(tripId, expenseId) {
  return call('delete_expense', { p_trip_id: tripId, p_expense_id: expenseId })
}

// rate に null を渡すとその通貨のレートを削除する
export function setRate(tripId, currency, rate) {
  return call('set_rate', { p_trip_id: tripId, p_currency: currency, p_rate: rate })
}
