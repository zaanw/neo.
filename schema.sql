-- Run once in Supabase SQL Editor. Demo coins have no monetary value.
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
 balance bigint not null default 1000 check (balance >= 0),
 card_last4 text not null check (card_last4 ~ '^[0-9]{4}$'),
 created_at timestamptz not null default now()
);
create table if not exists public.transfers (
 id bigint generated always as identity primary key,
 sender uuid not null references public.profiles(id),
 recipient uuid not null references public.profiles(id),
 amount bigint not null check (amount > 0),
 created_at timestamptz not null default now(),
 constraint different_users check (sender <> recipient)
);
create index if not exists transfers_sender_idx on public.transfers(sender,created_at desc);
create index if not exists transfers_recipient_idx on public.transfers(recipient,created_at desc);
alter table public.profiles enable row level security;
alter table public.transfers enable row level security;
revoke all on public.profiles from anon, authenticated;
revoke all on public.transfers from anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.transfers to authenticated;
create policy "read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "read own transfers" on public.transfers for select to authenticated using (sender = (select auth.uid()) or recipient = (select auth.uid()));

-- Profiles are created from auth metadata, never by direct client writes.
create or replace function public.new_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uname text;
begin
 uname := lower(coalesce(new.raw_user_meta_data->>'username',''));
 if uname !~ '^[a-z0-9_]{3,20}$' then raise exception 'Invalid username'; end if;
 insert into public.profiles(id, username, card_last4)
 values(new.id,uname,lpad((floor(random()*10000))::int::text,4,'0'));
 return new;
end $$;
drop trigger if exists create_profile on auth.users;
create trigger create_profile after insert on auth.users for each row execute function public.new_user_profile();

-- Atomic transfer with balance checks and consistent locking order.
create or replace function public.send_demo_coins(target_username text, coins bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare src uuid := auth.uid(); dst uuid; available bigint;
begin
 if src is null then raise exception 'Not authenticated'; end if;
 if coins is null or coins < 1 or coins > 1000000000 then raise exception 'Invalid amount'; end if;
 select id into dst from public.profiles where username = lower(trim(target_username));
 if dst is null then raise exception 'User not found'; end if;
 if src = dst then raise exception 'Cannot send to yourself'; end if;
 -- Lock both accounts in deterministic order to avoid deadlocks.
 perform 1 from public.profiles where id in (src,dst) order by id for update;
 select balance into available from public.profiles where id = src;
 if available is null or available < coins then raise exception 'Insufficient balance'; end if;
 update public.profiles set balance = balance - coins where id = src;
 update public.profiles set balance = balance + coins where id = dst;
 insert into public.transfers(sender,recipient,amount) values(src,dst,coins);
end $$;
revoke all on function public.send_demo_coins(text,bigint) from public, anon;
grant execute on function public.send_demo_coins(text,bigint) to authenticated;

-- Secure transaction history includes the counterparty username without exposing their balance.
create or replace function public.my_demo_history()
returns table(id bigint, direction text, counterparty text, amount bigint, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
 select t.id, case when t.sender = auth.uid() then 'out' else 'in' end,
 p.username, t.amount, t.created_at
 from public.transfers t
 join public.profiles p on p.id = case when t.sender = auth.uid() then t.recipient else t.sender end
 where t.sender = auth.uid() or t.recipient = auth.uid()
 order by t.created_at desc limit 100;
$$;
revoke all on function public.my_demo_history() from public, anon;
grant execute on function public.my_demo_history() to authenticated;
