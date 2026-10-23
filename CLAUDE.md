# trip-splitter-share

## プロジェクト概要

友達との旅行で使う立替精算アプリ。
共有URLを知っているメンバー全員が、同じ旅行の記録を閲覧・追加できる。

- ログイン機能はなし。旅行ごとに発行される共有URL（推測されにくいID）を知っていることがアクセス条件
- 誰が・いくら・誰の分を立て替えたかを記録し、最終的に「誰が誰にいくら払えば精算が終わるか」を計算する

## 技術スタック

- **フロントエンド**: React + Vite
- **データベース**: Supabase（データベースのみ使用。Supabase Auth などの認証機能は使わない）
- **ホスティング**: Vercel

## 環境変数

`.env`（ローカル）および Vercel の環境変数設定で管理する。

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

- コードからは `import.meta.env.VITE_SUPABASE_URL` のように参照する
- `.env` は `.gitignore` に含め、Git にコミットしない
- 必要な変数名の一覧は `.env.example`（値は空）で共有する

## 開発環境

- 開発サーバーは `npm run dev` で **5180番ポート**（http://localhost:5180/）。他のプロジェクトが5173番を使っているため変更しないこと（`vite.config.js` で固定済み）
- `main` にプッシュすると Vercel が自動でデプロイする（公開URL：https://trip-splitter-share.vercel.app/）

## データベースの変更手順

- テーブル・関数の変更は `supabase/schema.sql` に追記・修正する。ファイル全体を何度実行しても壊れない形（`if not exists`、`create or replace` など）を保つ
- 変更後はユーザーに「schema.sql 全体を SQL Editor で再実行」してもらう。`drop function` を含むと「destructive operation」の警告が出るが、データは消えないと伝える
- 関数の引数を変えるときは、古い引数の関数を `drop function if exists` で削除してから作り直し、`revoke` / `grant` の行も更新する
- 新しい関数は `security definer` と `set search_path = ''` を付け、旅行IDを引数に取り、その旅行のデータだけを扱う。実行権限は anon と authenticated にだけ付与する
- 内部用の関数は `private` スキーマに置く（API として公開されない）
- SQL を実行する前に Vercel に反映されても既存の機能が壊れないよう、フロントエンドは新しい引数を必要なときだけ送るなど互換性に気を付ける

## デザインの方針

空港・搭乗券をモチーフにした、落ち着いた大人っぽいデザイン。

- 色：濃紺（`--ink`）を基調に、琥珀色（`--accent`）を差し色として少しだけ使う。色は `src/index.css` の `:root` の変数を使う
- 文字：本文は Noto Sans JP、金額・英字の小見出しは Space Grotesk
- **絵文字は使わない**（子供っぽくなるため）。カードの見出しは英字の小見出し（`SectionTitle` の `en`）＋日本語の見出しにする
- 支払いの分類は空港コード風の3文字（`src/ui.jsx` の `expenseCategory`）
- スマホ（幅390px前後）で使いやすいことを最優先にする。入力欄の文字は16px以上（iOS の拡大防止）

## 言語ルール

- Claude の返答は**必ず日本語**で書く
- コード内のコメントも**日本語**で書く

## Git 運用ルール

- コードを変更するたびに、コミットして GitHub にプッシュする
- コミットメッセージは日本語で、変更内容が分かるように簡潔に書く
- プッシュ前に `.env` などの秘密情報がステージされていないか確認する

## 禁止事項

- **Supabase の Secret key（service_role key / `sb_secret_...`）は絶対に使わない。**
  フロントエンドから使うのは Publishable key（anon key）のみ
- **`.env` の中身（URL・キーなどの値）をコードに直接書かない。** 必ず環境変数経由で参照する

## 注意点

- ログインがないため、データの保護は Supabase の RLS（Row Level Security）ポリシーで行う。
  テーブル作成時は RLS を有効にし、必要な操作（閲覧・追加など）だけを許可する
- 共有URLのIDは連番ではなく、UUID などの推測されにくい値を使う
