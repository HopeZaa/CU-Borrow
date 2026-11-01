-- CU-Borrow. Apply to a fresh Supabase project through `supabase db push`.
create extension if not exists btree_gist;
create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(char_length(display_name) between 2 and 80),
 faculty text not null default '' check(char_length(faculty)<=100),
 bio text not null default '' check(char_length(bio)<=500),
 verification_status text not null default 'unverified' check(verification_status in ('unverified','pending','verified')),
 suspended boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.user_roles (user_id uuid primary key references profiles(id), role text not null check(role='admin'));
create table public.items (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references profiles(id),
 title text not null check(char_length(title) between 3 and 120),
 description text not null check(char_length(description) between 20 and 4000),
 category text not null check(category in ('electronics','camera','study','project','lifestyle','other')),
 condition text not null check(condition in ('like_new','good','fair')),
 daily_price numeric(10,2) not null check(daily_price between 1 and 100000),
 deposit numeric(10,2) not null default 0 check(deposit between 0 and 1000000),
 pickup_location text not null check(char_length(pickup_location) between 3 and 200),
 available_from date not null default current_date, available_until date not null,
 status text not null default 'active' check(status in ('active','archived','suspended')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(available_until>=available_from)
);
create index items_catalog_idx on items(status,category,created_at desc);
create index items_owner_idx on items(owner_id);
create index items_title_idx on items(lower(title) text_pattern_ops);
create table public.item_images (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references items(id) on delete cascade,
 storage_path text not null unique, created_at timestamptz not null default now()
);
create index item_images_item_idx on item_images(item_id);
-- Blackout dates. The listing's from/until dates define the outer availability window.
create table public.item_availability (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references items(id) on delete cascade,
 start_date date not null, end_date date not null, check(end_date>=start_date)
);
create index item_availability_item_idx on item_availability(item_id);
create table public.bookings (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references items(id),
 renter_id uuid not null references profiles(id), owner_id uuid not null references profiles(id),
 start_date date not null, end_date date not null,
 rental_days integer generated always as (end_date-start_date+1) stored,
 daily_price numeric(10,2) not null check(daily_price>0),
 rental_total numeric(12,2) not null check(rental_total>0), deposit numeric(12,2) not null check(deposit>=0),
 platform_fee numeric(12,2) not null default 0 check(platform_fee>=0),
 status text not null default 'pending' check(status in ('pending','confirmed','paid','picked_up','returned','completed','cancelled','disputed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(start_date<=end_date and end_date-start_date<366), check(owner_id<>renter_id),
 constraint no_overlapping_bookings exclude using gist
 (item_id with =, daterange(start_date,end_date,'[]') with &&)
 where (status in ('pending','confirmed','paid','picked_up','returned','disputed'))
);
create index bookings_renter_idx on bookings(renter_id,created_at desc);
create index bookings_owner_idx on bookings(owner_id,status);
create table public.payments (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null unique references bookings(id),
 provider text not null check(provider in ('development','gateway')),
 provider_reference text unique, simulated boolean not null,
 amount numeric(12,2) not null check(amount>=0), deposit_amount numeric(12,2) not null check(deposit_amount>=0),
 status text not null check(status in ('simulated','held','released','refunded')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((provider='development' and simulated) or (provider='gateway' and not simulated))
);
create table public.handovers (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references bookings(id),
 kind text not null check(kind in ('pickup','return')), user_id uuid not null references profiles(id),
 evidence_path text not null, confirmed_at timestamptz not null default now(),
 unique(booking_id,kind,user_id)
);
create index handovers_booking_idx on handovers(booking_id);
create table public.reviews (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null unique references bookings(id),
 reviewer_id uuid not null references profiles(id), reviewee_id uuid not null references profiles(id),
 rating integer not null check(rating between 1 and 5), comment text not null check(char_length(comment) between 3 and 1000),
 created_at timestamptz not null default now()
);
create index reviews_reviewee_idx on reviews(reviewee_id);
create table public.disputes (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references bookings(id),
 opened_by uuid not null references profiles(id), reason text not null check(char_length(reason) between 10 and 2000),
 previous_status text not null, status text not null default 'open' check(status in ('open','resolved')),
 resolution text, resolved_by uuid references profiles(id), created_at timestamptz not null default now(), resolved_at timestamptz
);
create unique index one_open_dispute on disputes(booking_id) where status='open';
create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id),
 message text not null, booking_id uuid references bookings(id), read_at timestamptz, created_at timestamptz not null default now()
);
create index notifications_recipient_idx on notifications(user_id,created_at desc);
create table public.admin_audit_logs (
 id uuid primary key default gen_random_uuid(), admin_id uuid not null references profiles(id),
 action text not null, target_id uuid not null, detail text not null, created_at timestamptz not null default now()
);

create function private.is_admin() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from user_roles r join profiles p on p.id=r.user_id where r.user_id=auth.uid() and r.role='admin' and not p.suspended)
$$;
-- Each mutating RPC independently verifies current identity, confirmed email and suspension.
create function private.actor() returns uuid language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();
begin
 if u is null or not exists(select 1 from profiles p join auth.users a on a.id=p.id where p.id=u and not p.suspended and a.email_confirmed_at is not null) then
  raise exception 'กรุณายืนยันอีเมลและเข้าสู่ระบบด้วยบัญชีที่ใช้งานได้' using errcode='42501';
 end if;
 return u;
end $$;
create function private.today() returns date language sql stable as $$ select (now() at time zone 'Asia/Bangkok')::date $$;
create function private.notify(b bookings,msg text) returns void language sql security definer set search_path=public,pg_temp as $$
 insert into notifications(user_id,message,booking_id) values (b.owner_id,msg,b.id),(b.renter_id,msg,b.id)
$$;
create function private.new_profile() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into profiles(id,display_name) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'สมาชิก CU-Borrow'),80));
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.new_profile();

-- Public aggregate only; no email, role, booking dates or private financial records.
create view public.owner_stats as select p.id,
 (select round(avg(r.rating),1) from reviews r where r.reviewee_id=p.id) rating,
 (select count(*)::int from reviews r where r.reviewee_id=p.id) review_count,
 (select count(*)::int from bookings b where b.owner_id=p.id and b.status='completed') completed_count
 from profiles p;
grant select on owner_stats to anon,authenticated;

alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table items enable row level security;
alter table item_images enable row level security;
alter table item_availability enable row level security;
alter table bookings enable row level security;
alter table payments enable row level security;
alter table handovers enable row level security;
alter table reviews enable row level security;
alter table disputes enable row level security;
alter table notifications enable row level security;
alter table admin_audit_logs enable row level security;
grant usage on schema private to anon,authenticated;
grant execute on function private.is_admin() to anon,authenticated;
create policy profile_read on profiles for select using (true);
create policy profile_edit on profiles for update to authenticated using(id=auth.uid() and not suspended) with check(id=auth.uid());
create policy role_read on user_roles for select to authenticated using(user_id=auth.uid() or private.is_admin());
create policy item_read on items for select using(status='active' or owner_id=auth.uid() or private.is_admin());
create policy image_read on item_images for select using(exists(select 1 from items where id=item_id));
create policy availability_read on item_availability for select using(exists(select 1 from items where id=item_id));
create policy booking_read on bookings for select to authenticated using(auth.uid() in (renter_id,owner_id) or private.is_admin());
create policy payment_read on payments for select to authenticated using(exists(select 1 from bookings where id=booking_id));
create policy handover_read on handovers for select to authenticated using(exists(select 1 from bookings where id=booking_id));
create policy review_read on reviews for select using(true);
create policy dispute_read on disputes for select to authenticated using(exists(select 1 from bookings where id=booking_id));
create policy notification_read on notifications for select to authenticated using(user_id=auth.uid());
create policy notification_update on notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy audit_read on admin_audit_logs for select to authenticated using(private.is_admin());

-- Supabase normally grants broad table access; explicitly narrow it.
revoke all on profiles,user_roles,items,item_images,item_availability,bookings,payments,handovers,reviews,disputes,notifications,admin_audit_logs from anon,authenticated;
grant select on profiles,items,item_images,item_availability,reviews to anon,authenticated;
grant select on user_roles,bookings,payments,handovers,disputes,notifications,admin_audit_logs to authenticated;
grant update(display_name,faculty,bio) on profiles to authenticated;
grant update(read_at) on notifications to authenticated;

create function public.cu_save_item(p_id uuid,p_title text,p_description text,p_category text,p_condition text,p_price numeric,p_deposit numeric,p_location text,p_from date,p_until date) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor(); result uuid;
begin
 if p_from is null or p_until is null or p_until<private.today() or p_until<p_from then raise exception 'ช่วงวันที่ไม่ถูกต้อง'; end if;
 if p_id is null then
  insert into items(owner_id,title,description,category,condition,daily_price,deposit,pickup_location,available_from,available_until)
  values(u,trim(p_title),trim(p_description),p_category,p_condition,p_price,p_deposit,trim(p_location),p_from,p_until) returning id into result;
 else
  perform 1 from items where id=p_id and owner_id=u and status<>'suspended' for update;
  if not found then raise exception 'ไม่พบประกาศหรือไม่มีสิทธิ์แก้ไข' using errcode='42501'; end if;
  if exists(select 1 from bookings where item_id=p_id and status not in ('cancelled','completed') and (start_date<p_from or end_date>p_until)) then raise exception 'ช่วงวันใหม่ทับรายการจองเดิม'; end if;
  update items set title=trim(p_title),description=trim(p_description),category=p_category,condition=p_condition,daily_price=p_price,deposit=p_deposit,pickup_location=trim(p_location),available_from=p_from,available_until=p_until,updated_at=now() where id=p_id returning id into result;
 end if;
 return result;
end $$;
create function public.cu_archive_item(p_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor();
begin
 perform 1 from items where id=p_id and owner_id=u and status='active' for update;
 if not found then raise exception 'ไม่มีสิทธิ์ลบประกาศ' using errcode='42501'; end if;
 if exists(select 1 from bookings where item_id=p_id and status not in ('completed','cancelled')) then raise exception 'ยังมีการเช่าที่ยังไม่สิ้นสุด'; end if;
 update items set status='archived',updated_at=now() where id=p_id;
end $$;
create function public.cu_blackout(p_item uuid,p_start date,p_end date,p_remove uuid default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor();
begin
 perform 1 from items where id=p_item and owner_id=u and status='active' for update;
 if not found then raise exception 'ไม่มีสิทธิ์แก้ไข' using errcode='42501'; end if;
 if p_remove is not null then delete from item_availability where id=p_remove and item_id=p_item; return; end if;
 if p_start is null or p_end is null or p_end<p_start then raise exception 'วันที่ไม่ถูกต้อง'; end if;
 if exists(select 1 from bookings where item_id=p_item and status not in ('completed','cancelled') and daterange(start_date,end_date,'[]') && daterange(p_start,p_end,'[]')) then raise exception 'มีรายการจองในช่วงนี้แล้ว'; end if;
 insert into item_availability(item_id,start_date,end_date) values(p_item,p_start,p_end);
end $$;
create function public.cu_image(p_item uuid,p_path text,p_remove boolean default false) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor();
begin
 perform 1 from items where id=p_item and owner_id=u and status='active' for update;
 if not found then raise exception 'ไม่มีสิทธิ์จัดการรูปภาพ' using errcode='42501'; end if;
 if p_path not like u::text||'/'||p_item::text||'/%' then raise exception 'เส้นทางรูปภาพไม่ถูกต้อง'; end if;
 if p_remove then delete from item_images where item_id=p_item and storage_path=p_path; return; end if;
 if (select count(*) from item_images where item_id=p_item)>=6 then raise exception 'สูงสุด 6 รูป'; end if;
 if not exists(select 1 from storage.objects where bucket_id='item-images' and name=p_path) then raise exception 'ไม่พบไฟล์ภาพ'; end if;
 insert into item_images(item_id,storage_path) values(p_item,p_path);
end $$;
create function public.cu_unavailable(p_item uuid) returns table(start_date date,end_date date) language sql stable security definer set search_path=public,pg_temp as $$
 select b.start_date,b.end_date from bookings b join items i on i.id=b.item_id where b.item_id=p_item and i.status='active' and b.status not in ('completed','cancelled')
 union all select a.start_date,a.end_date from item_availability a join items i on i.id=a.item_id where a.item_id=p_item and i.status='active'
$$;
create function public.cu_search(p_query text default '',p_category text default '',p_min numeric default 0,p_max numeric default 100000,p_start date default null,p_end date default null,p_sort text default 'newest') returns setof items
language sql stable security definer set search_path=public,pg_temp as $$
 select i.* from items i join profiles p on p.id=i.owner_id where i.status='active' and not p.suspended
 and (p_query='' or i.title ilike '%'||left(p_query,120)||'%') and (p_category='' or i.category=p_category)
 and i.daily_price between p_min and p_max
 and (p_start is null or p_end is null or (p_start>=i.available_from and p_end<=i.available_until and p_end>=p_start
 and not exists(select 1 from cu_unavailable(i.id) u where daterange(u.start_date,u.end_date,'[]') && daterange(p_start,p_end,'[]'))))
 order by case when p_sort='price_asc' then i.daily_price end asc,case when p_sort='price_desc' then i.daily_price end desc,i.created_at desc limit 100
$$;
create function public.cu_book(p_item uuid,p_start date,p_end date) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor(); i items; b bookings;
begin
 select * into i from items where id=p_item for update;
 if not found or i.status<>'active' or exists(select 1 from profiles where id=i.owner_id and suspended) then raise exception 'สินค้าไม่พร้อมให้เช่า'; end if;
 if u=i.owner_id then raise exception 'ไม่สามารถเช่าสินค้าของตนเองได้'; end if;
 if p_start is null or p_end is null or p_start<private.today() or p_end<p_start or p_end-p_start>=366 or p_start<i.available_from or p_end>i.available_until then raise exception 'วันที่ไม่อยู่ในช่วงที่เปิดให้เช่า'; end if;
 if exists(select 1 from item_availability where item_id=p_item and daterange(start_date,end_date,'[]') && daterange(p_start,p_end,'[]')) then raise exception 'เจ้าของปิดให้เช่าในวันที่เลือก'; end if;
 insert into bookings(item_id,renter_id,owner_id,start_date,end_date,daily_price,rental_total,deposit)
 values(p_item,u,i.owner_id,p_start,p_end,i.daily_price,i.daily_price*(p_end-p_start+1),i.deposit) returning * into b;
 perform private.notify(b,'มีคำขอเช่าใหม่ รอเจ้าของยืนยัน');
 return b.id;
exception when exclusion_violation then raise exception 'วันที่เลือกถูกจองแล้ว กรุณาเลือกวันอื่น' using errcode='23P01';
end $$;
create function public.cu_transition(p_booking uuid,p_action text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor(); b bookings; target text;
begin
 select * into b from bookings where id=p_booking for update;
 if not found or u not in (b.owner_id,b.renter_id) then raise exception 'ไม่มีสิทธิ์จัดการรายการนี้' using errcode='42501'; end if;
 if p_action='confirm' and u=b.owner_id and b.status='pending' and b.start_date>=private.today() then target:='confirmed';
 elsif p_action='reject' and u=b.owner_id and b.status='pending' then target:='cancelled';
 elsif p_action='cancel' and u=b.renter_id and b.status in ('pending','confirmed') and b.start_date>=private.today() then target:='cancelled';
 elsif p_action='complete' and b.status='returned' then target:='completed';
 else raise exception 'ไม่สามารถเปลี่ยนสถานะนี้ได้ การยกเลิกทำได้ก่อนรับของและก่อนวันเริ่มเช่าเฉพาะรายการที่ยังไม่ชำระ'; end if;
 update bookings set status=target,updated_at=now() where id=b.id;
 if target='completed' then update payments set status='released',updated_at=now() where booking_id=b.id; end if;
 perform private.notify(b,'สถานะรายการเช่า: '||target);
end $$;
-- Service role only. The application additionally requires NODE_ENV=development and explicit opt-in.
create function public.cu_simulate_payment(p_booking uuid,p_actor uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare b bookings;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'service role required' using errcode='42501'; end if;
 select * into b from bookings where id=p_booking for update;
 if not found or b.renter_id<>p_actor or b.status<>'confirmed' or b.start_date<private.today() or exists(select 1 from profiles where id=p_actor and suspended) then raise exception 'รายการไม่พร้อมจำลองการชำระ'; end if;
 insert into payments(booking_id,provider,simulated,amount,deposit_amount,status) values(b.id,'development',true,b.rental_total+b.deposit+b.platform_fee,b.deposit,'simulated');
 update bookings set status='paid',updated_at=now() where id=b.id;
 perform private.notify(b,'บันทึกการชำระเงินจำลองสำหรับ Development เท่านั้น ไม่มีการชำระเงินจริง');
end $$;
create function public.cu_handover(p_booking uuid,p_kind text,p_evidence text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor(); b bookings;
begin
 select * into b from bookings where id=p_booking for update;
 if not found or u not in (b.owner_id,b.renter_id) then raise exception 'ไม่มีสิทธิ์ยืนยันรับคืน' using errcode='42501'; end if;
 if not ((p_kind='pickup' and b.status='paid' and private.today()>=b.start_date) or (p_kind='return' and b.status='picked_up')) then raise exception 'สถานะหรือวันรับของยังไม่ถูกต้อง'; end if;
 if p_evidence not like u::text||'/'||b.id::text||'/'||p_kind||'/%' or not exists(select 1 from storage.objects where bucket_id='handover-evidence' and name=p_evidence) then raise exception 'กรุณาอัปโหลดหลักฐานของตนเอง'; end if;
 insert into handovers(booking_id,kind,user_id,evidence_path) values(b.id,p_kind,u,p_evidence);
 if (select count(*) from handovers where booking_id=b.id and kind=p_kind)=2 then
  update bookings set status=case p_kind when 'pickup' then 'picked_up' else 'returned' end,updated_at=now() where id=b.id;
 end if;
 perform private.notify(b,'มีการยืนยันส่งมอบ: '||p_kind);
end $$;
create function public.cu_review(p_booking uuid,p_rating integer,p_comment text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor(); b bookings;
begin
 select * into b from bookings where id=p_booking for update;
 if not found or b.renter_id<>u or b.status<>'completed' then raise exception 'รีวิวได้เฉพาะผู้เช่าเมื่อการเช่าสำเร็จ' using errcode='42501'; end if;
 insert into reviews(booking_id,reviewer_id,reviewee_id,rating,comment) values(b.id,u,b.owner_id,p_rating,trim(p_comment));
end $$;
create function public.cu_dispute(p_booking uuid,p_reason text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor(); b bookings;
begin
 select * into b from bookings where id=p_booking for update;
 if not found or u not in (b.owner_id,b.renter_id) or b.status not in ('confirmed','paid','picked_up','returned') then raise exception 'ไม่สามารถเปิดข้อพิพาทในสถานะนี้' using errcode='42501'; end if;
 insert into disputes(booking_id,opened_by,reason,previous_status) values(b.id,u,trim(p_reason),b.status);
 update bookings set status='disputed',updated_at=now() where id=b.id;
 update payments set status='held',updated_at=now() where booking_id=b.id;
 perform private.notify(b,'เปิดข้อพิพาทแล้ว รอ Admin ตรวจสอบ');
end $$;
create function public.cu_admin(p_action text,p_target uuid,p_detail text,p_value text default '') returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor(); d disputes; b bookings;
begin
 if not private.is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 if char_length(trim(p_detail))<5 or char_length(p_detail)>2000 then raise exception 'กรุณาระบุเหตุผล 5–2000 ตัวอักษร'; end if;
 if p_action='suspend_user' then
  if p_target=u or exists(select 1 from user_roles where user_id=p_target) then raise exception 'ไม่สามารถระงับบัญชี Admin'; end if;
  if p_value not in ('true','false') then raise exception 'ค่าไม่ถูกต้อง'; end if;
  update profiles set suspended=p_value::boolean where id=p_target;
 elsif p_action='moderate_item' then
  if p_value not in ('active','suspended') then raise exception 'สถานะไม่ถูกต้อง'; end if;
  update items set status=p_value,updated_at=now() where id=p_target and status<>'archived';
 elsif p_action='resolve_dispute' then
  -- Lock booking first: same lock order as cu_dispute, preventing deadlocks.
  select booking_id into b.id from disputes where id=p_target;
  select * into b from bookings where id=b.id for update;
  select * into d from disputes where id=p_target and status='open' for update;
  if d.id is null or b.status<>'disputed' or p_value not in ('resume','cancel') then raise exception 'ข้อพิพาทไม่พร้อมแก้ไข'; end if;
  update disputes set status='resolved',resolution=p_detail,resolved_by=u,resolved_at=now() where id=d.id;
  update bookings set status=case p_value when 'cancel' then 'cancelled' else d.previous_status end,updated_at=now() where id=b.id;
  update payments set status=case p_value when 'cancel' then 'refunded' else 'simulated' end,updated_at=now() where booking_id=b.id and simulated;
  perform private.notify(b,'Admin แก้ไขข้อพิพาทแล้ว: '||p_detail);
 else raise exception 'คำสั่งไม่ถูกต้อง'; end if;
 if not found then raise exception 'ไม่พบข้อมูล'; end if;
 insert into admin_audit_logs(admin_id,action,target_id,detail) values(u,p_action,p_target,p_detail||' ['||p_value||']');
end $$;

-- Remove implicit PUBLIC execution from all app RPCs and internal helpers.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='private' or (n.nspname='public' and p.proname like 'cu_%') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
grant execute on function private.is_admin() to anon,authenticated;
grant execute on function public.cu_search(text,text,numeric,numeric,date,date,text),public.cu_unavailable(uuid) to anon,authenticated;
grant execute on function public.cu_save_item(uuid,text,text,text,text,numeric,numeric,text,date,date),public.cu_archive_item(uuid),public.cu_blackout(uuid,date,date,uuid),public.cu_image(uuid,text,boolean),public.cu_book(uuid,date,date),public.cu_transition(uuid,text),public.cu_handover(uuid,text,text),public.cu_review(uuid,integer,text),public.cu_dispute(uuid,text),public.cu_admin(text,uuid,text,text) to authenticated;
grant execute on function public.cu_simulate_payment(uuid,uuid) to service_role;

-- Bucket MIME/size checks also apply to direct client uploads.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('item-images','item-images',true,5242880,array['image/jpeg','image/png','image/webp']),
 ('handover-evidence','handover-evidence',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy listing_storage_read on storage.objects for select using(bucket_id='item-images');
create policy listing_storage_insert on storage.objects for insert to authenticated with check(
 bucket_id='item-images' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from items where id::text=(storage.foldername(name))[2] and owner_id=auth.uid() and status='active')
 and exists(select 1 from profiles where id=auth.uid() and not suspended)
);
create policy listing_storage_delete on storage.objects for delete to authenticated using(bucket_id='item-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy evidence_read on storage.objects for select to authenticated using(bucket_id='handover-evidence' and exists(select 1 from bookings where id::text=(storage.foldername(name))[2] and (auth.uid() in (owner_id,renter_id) or private.is_admin())));
create policy evidence_insert on storage.objects for insert to authenticated with check(
 bucket_id='handover-evidence' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from bookings where id::text=(storage.foldername(name))[2] and auth.uid() in (owner_id,renter_id) and ((status='paid' and (storage.foldername(name))[3]='pickup') or (status='picked_up' and (storage.foldername(name))[3]='return')))
 and exists(select 1 from profiles where id=auth.uid() and not suspended)
);
