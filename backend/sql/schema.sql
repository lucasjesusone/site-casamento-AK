create table if not exists gifts (
  id text primary key,
  title text not null,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  image_url text not null,
  created_at text not null
);

create table if not exists orders (
  id text primary key,
  preference_id text,
  payment_id text unique,
  status text not null,
  total numeric(12, 2) not null check (total > 0),
  currency text not null default 'BRL',
  payment_method text,
  created_at text not null,
  updated_at text not null
);

create table if not exists order_items (
  order_id text not null references orders(id) on delete cascade,
  gift_id text not null,
  title text not null,
  quantity integer not null check (quantity > 0),
  unit_amount numeric(12, 2) not null check (unit_amount > 0),
  primary key (order_id, gift_id)
);

create table if not exists families (
  id text primary key,
  name text not null,
  code text not null unique,
  created_at text not null
);

create table if not exists guests (
  id text primary key,
  family_id text not null references families(id) on delete cascade,
  name text not null,
  category text not null default 'adult' check (category in ('adult', 'child_half', 'child_free')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined')),
  responded_at text,
  position integer not null default 0
);

create index if not exists guests_family_id_idx on guests(family_id);
