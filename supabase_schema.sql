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
  category text,
  image_url text,
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

-- 9. Materials enhancements migration (category and image_url)
alter table materials add column if not exists image_url text;

-- 10. Storage Buckets for material images, logos, and signatures:
-- Create a public bucket named 'material-images' (or 'company-assets') in Supabase Dashboard -> Storage.
-- Ensure the bucket is toggled to Public so images load without signed URLs.

-- 11. Materials inventory tracking migration
alter table materials add column if not exists in_stock boolean default true;
alter table materials add column if not exists stock_qty numeric;

-- 12. Separate Material Categories Table Migration
create table if not exists material_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamp with time zone default now()
);

alter table material_categories enable row level security;

create policy "auth_full_access" on material_categories 
  for all using (auth.role() = 'authenticated') 
  with check (auth.role() = 'authenticated');

-- Migrate materials to reference category_id instead of a plain text category
alter table materials add column if not exists category_id uuid references material_categories(id) on delete set null;

-- Populate material_categories from existing distinct text categories and link them
insert into material_categories (name)
select distinct trim(category) from materials
where category is not null and trim(category) != ''
on conflict (name) do nothing;

update materials m
set category_id = c.id
from material_categories c
where trim(m.category) = c.name and m.category_id is null;




