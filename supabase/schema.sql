-- =====================================================================
-- trip-splitter-share：テーブル・RLS・データベース関数
-- Supabase の SQL Editor でまとめて実行する（何度実行しても壊れない）
--
-- 方針：
--   ・テーブルは RLS を有効にし、ポリシーを1つも作らない
--     → 匿名ユーザーはテーブルを直接読み書きできない（一覧取得も不可）
--   ・データの読み書きは、旅行IDを引数に取る関数（security definer）経由のみ
--     → 旅行ID（推測できないUUID）を知っている人だけが、その旅行のデータを扱える
-- =====================================================================

-- ---------------------------------------------------------------------
-- テーブル
-- ---------------------------------------------------------------------

-- 旅行（ID は推測できないランダムな UUID）
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  members text[] not null check (cardinality(members) between 1 and 30),
  -- 為替レート：{"USD": 150.5} のように「1単位 = 何円か」を通貨ごとに保存
  rates jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 支払い
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  payer text not null,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  description text not null default '' check (char_length(description) <= 200),
  split_among text[] not null check (cardinality(split_among) >= 1),
  created_at timestamptz not null default now()
);

create index if not exists expenses_trip_id_idx on public.expenses (trip_id);

-- ---------------------------------------------------------------------
-- RLS：有効化のみ（ポリシーなし＝直接アクセスはすべて拒否）
-- ---------------------------------------------------------------------
alter table public.trips enable row level security;
alter table public.expenses enable row level security;

-- 念のため、テーブルへの直接の権限も外しておく
revoke all on table public.trips from anon, authenticated;
revoke all on table public.expenses from anon, authenticated;

-- ---------------------------------------------------------------------
-- 関数：旅行を作成して ID を返す
-- ---------------------------------------------------------------------
create or replace function public.create_trip(p_name text, p_members text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_members text[];
  v_id uuid;
begin
  -- メンバー名の前後の空白を除き、空欄と重複を取り除く（入力順は維持）
  select coalesce(array_agg(m order by ord), '{}')
    into v_members
  from (
    select distinct on (btrim(x)) btrim(x) as m, ord
    from unnest(p_members) with ordinality as t(x, ord)
    where btrim(coalesce(x, '')) <> ''
    order by btrim(x), ord
  ) s;

  if v_name = '' or char_length(v_name) > 100 then
    raise exception '旅行名は1〜100文字で入力してください';
  end if;
  if cardinality(v_members) < 1 or cardinality(v_members) > 30 then
    raise exception 'メンバーは1〜30人で入力してください';
  end if;
  if exists (select 1 from unnest(v_members) as m where char_length(m) > 30) then
    raise exception 'メンバー名は30文字以内で入力してください';
  end if;

  insert into public.trips (name, members)
  values (v_name, v_members)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 関数：旅行の情報と支払い一覧を取得（見つからなければ null）
-- ---------------------------------------------------------------------
create or replace function public.get_trip(p_trip_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'members', to_jsonb(t.members),
    'rates', t.rates,
    'created_at', t.created_at,
    'expenses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'payer', e.payer,
          'amount', e.amount,
          'currency', e.currency,
          'description', e.description,
          'split_among', to_jsonb(e.split_among),
          'created_at', e.created_at
        )
        order by e.created_at desc
      )
      from public.expenses e
      where e.trip_id = t.id
    ), '[]'::jsonb)
  )
  from public.trips t
  where t.id = p_trip_id;
$$;

-- ---------------------------------------------------------------------
-- 関数：支払いを追加して ID を返す
-- ---------------------------------------------------------------------
create or replace function public.add_expense(
  p_trip_id uuid,
  p_payer text,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_split_among text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_members text[];
  v_split text[];
  v_currency text := upper(btrim(coalesce(p_currency, '')));
  v_description text := btrim(coalesce(p_description, ''));
  v_id uuid;
begin
  select members into v_members
  from public.trips
  where id = p_trip_id;

  if not found then
    raise exception '旅行が見つかりません';
  end if;

  if p_payer is null or not (p_payer = any (v_members)) then
    raise exception '払った人がメンバーに含まれていません';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount >= 1000000000000 then
    raise exception '金額が正しくありません';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception '通貨が正しくありません';
  end if;
  if char_length(v_description) > 200 then
    raise exception '内容は200文字以内で入力してください';
  end if;

  -- 割る人の重複を取り除き、全員がメンバーかを確認
  select coalesce(array_agg(distinct x), '{}')
    into v_split
  from unnest(p_split_among) as x
  where x is not null;

  if cardinality(v_split) < 1 then
    raise exception '割る人を1人以上選んでください';
  end if;
  if not (v_split <@ v_members) then
    raise exception '割る人にメンバー以外が含まれています';
  end if;

  insert into public.expenses (trip_id, payer, amount, currency, description, split_among)
  values (p_trip_id, p_payer, round(p_amount, 2), v_currency, v_description, v_split)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 関数：支払いを削除（旅行IDと支払いIDの両方が一致するものだけ）
-- ---------------------------------------------------------------------
create or replace function public.delete_expense(p_trip_id uuid, p_expense_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.expenses
  where id = p_expense_id
    and trip_id = p_trip_id;

  return found;
end;
$$;

-- ---------------------------------------------------------------------
-- 関数：為替レートを1通貨分だけ更新（null を渡すと削除）
-- 通貨ごとに更新するので、別の人が同時に別の通貨を編集しても上書きされない
-- ---------------------------------------------------------------------
create or replace function public.set_rate(p_trip_id uuid, p_currency text, p_rate numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_currency text := upper(btrim(coalesce(p_currency, '')));
  v_rates jsonb;
begin
  if v_currency !~ '^[A-Z]{3}$' or v_currency = 'JPY' then
    raise exception '通貨が正しくありません';
  end if;
  if p_rate is not null and (p_rate <= 0 or p_rate >= 1000000) then
    raise exception 'レートが正しくありません';
  end if;

  update public.trips
  set rates = case
    when p_rate is null then rates - v_currency
    else rates || jsonb_build_object(v_currency, p_rate)
  end
  where id = p_trip_id
  returning rates into v_rates;

  if not found then
    raise exception '旅行が見つかりません';
  end if;

  return v_rates;
end;
$$;

-- ---------------------------------------------------------------------
-- 関数の実行権限：既定の public への権限を外し、anon と authenticated にだけ付与
-- ---------------------------------------------------------------------
revoke execute on function public.create_trip(text, text[]) from public, anon, authenticated;
revoke execute on function public.get_trip(uuid) from public, anon, authenticated;
revoke execute on function public.add_expense(uuid, text, numeric, text, text, text[]) from public, anon, authenticated;
revoke execute on function public.delete_expense(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.set_rate(uuid, text, numeric) from public, anon, authenticated;

grant execute on function public.create_trip(text, text[]) to anon, authenticated;
grant execute on function public.get_trip(uuid) to anon, authenticated;
grant execute on function public.add_expense(uuid, text, numeric, text, text, text[]) to anon, authenticated;
grant execute on function public.delete_expense(uuid, uuid) to anon, authenticated;
grant execute on function public.set_rate(uuid, text, numeric) to anon, authenticated;
