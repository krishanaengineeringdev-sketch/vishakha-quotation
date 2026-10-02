-- Vishakha Industries Quotation App Database Schema
-- Run this script in the Supabase SQL Editor

-- 1. Create company_profile table
create table if not exists company_profile (
  id uuid primary key default gen_random_uuid(),
  name text default 'Vishakha Industries',
  owner_name text,
  address text,
  phone text,
  email text,
  logo_url text,
  signature_url text,
  default_greeting text default 'Dear Sir/Mam, Thank you for your valuable inquiry. We are pleased to quote as below:',
  default_closing text default 'We hope you find our offer to be in line with your requirement.'
);

-- 2. Create customers table
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  place text,
  constraint customers_name_unique unique (name)
);

-- 3. Create quotations table
create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  quote_no text not null,
  quote_date date not null,
  customer_id uuid references customers(id),
  greeting text,
  closing text,
  grand_total numeric default 0,
  created_at timestamp with time zone default now()
);

-- 4. Create materials table
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  unit text default 'Nos',
  rate numeric default 0,
  description text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- 5. Create quotation_items table
create table if not exists quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid references quotations(id) on delete cascade,
  material_id uuid references materials(id) on delete set null,
  sl_no integer,
  description text,
  unit text default 'Nos',
  qty numeric,
  price numeric,
  total numeric
);

-- 6. Enable Row Level Security (RLS)
alter table company_profile enable row level security;
alter table customers enable row level security;
alter table quotations enable row level security;
alter table quotation_items enable row level security;
alter table materials enable row level security;

-- 7. Create RLS Policies for Authenticated Users
create policy "auth_full_access" on company_profile 
  for all using (auth.role() = 'authenticated') 
  with check (auth.role() = 'authenticated');

create policy "auth_full_access" on customers 
  for all using (auth.role() = 'authenticated') 
  with check (auth.role() = 'authenticated');

create policy "auth_full_access" on quotations 
  for all using (auth.role() = 'authenticated') 
  with check (auth.role() = 'authenticated');

create policy "auth_full_access" on quotation_items 
  for all using (auth.role() = 'authenticated') 
  with check (auth.role() = 'authenticated');

create policy "auth_full_access" on materials 
  for all using (auth.role() = 'authenticated') 
  with check (auth.role() = 'authenticated');

-- 8. Safe constraint migration if table already exists
alter table quotation_items drop constraint if exists quotation_items_material_id_fkey;
alter table quotation_items add constraint quotation_items_material_id_fkey 
  foreign key (material_id) references materials(id) on delete set null;

-- 9. (Optional Storage Bucket for logos and signatures)
-- You can create a public storage bucket named 'company-assets' in Supabase Storage.

