import { createClient } from '@supabase/supabase-js'

// 接続情報は .env（Vercel では環境変数）から読み込む。値をコードに直接書かないこと
const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error('VITE_SUPABASE_URL と VITE_SUPABASE_PUBLISHABLE_KEY を .env に設定してください')
}

// ログイン機能は使わないので、セッションの保存・更新はしない
export const supabase = createClient(url, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
