-- Comprehensive, audited application administration. Authentication secrets stay in Auth.
begin;
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from user_roles r join profiles p on p.id=r.user_id join auth.users a on a.id=p.id where r.user_id=auth.uid() and r.role='admin' and not p.suspended and a.email_confirmed_at is not null)
$$;
alter table public.admin_audit_logs add column if not exists before_data jsonb;
alter table public.admin_audit_logs add column if not exists after_data jsonb;

create or replace function public.cu_admin_me() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select private.is_admin() and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
$$;
create or replace function private.admin_columns(p_table text) returns text[] language sql immutable set search_path=public,pg_temp as $$
 select case p_table
 when 'profiles' then array['display_name','faculty','bio','verification_status','suspended']
 when 'items' then array['owner_id','title','description','category','condition','daily_price','deposit','pickup_location','available_from','available_until','status']
 when 'item_images' then array['item_id','storage_path']
 when 'item_availability' then array['item_id','start_date','end_date']
 when 'bookings' then array['item_id','renter_id','owner_id','start_date','end_date','daily_price','deposit','platform_fee','status']
 when 'payments' then array['amount','deposit_amount','status']
 when 'handovers' then array['evidence_path','confirmed_at']
 when 'reviews' then array['rating','comment']
 when 'disputes' then array['reason','resolution']
 when 'notifications' then array['user_id','message','booking_id','read_at']
 when 'user_roles' then array[]::text[]
 when 'admin_audit_logs' then array[]::text[]
 end
$$;

create or replace function public.cu_admin_rows(p_table text,p_search text default '',p_page integer default 1,p_size integer default 20) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor(); query text; ordering text; rows_json jsonb; total bigint;
begin
 if not private.is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 if private.admin_columns(p_table) is null or p_page<1 or p_size not between 1 and 50 or char_length(p_search)>200 then raise exception 'Invalid admin query'; end if;
 if p_table='profiles' then
  query:='select to_jsonb(p)||jsonb_build_object(''email'',a.email,''email_confirmed_at'',a.email_confirmed_at,''role'',case when r.user_id is null then ''member'' else ''admin'' end) as row from profiles p join auth.users a on a.id=p.id left join user_roles r on r.user_id=p.id';
 else query:=format('select to_jsonb(t) as row from public.%I t',p_table); end if;
 ordering:=case p_table when 'user_roles' then 'row->>''user_id''' else 'coalesce(row->>''created_at'',row->>''confirmed_at'',row->>''id'') desc,row->>''id''' end;
 execute 'select count(*) from ('||query||') q where $1='''' or row::text ilike ''%''||$1||''%''' into total using p_search;
 execute 'select coalesce(jsonb_agg(row),''[]''::jsonb) from (select row from ('||query||') q where $1='''' or row::text ilike ''%''||$1||''%'' order by '||ordering||' limit $2 offset $3) page' into rows_json using p_search,p_size,(p_page-1)::bigint*p_size;
 return jsonb_build_object('rows',rows_json,'total',total,'page',p_page,'size',p_size);
end $$;

create or replace function public.cu_admin_summary() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor(); result jsonb:='{}'; t text; n bigint;
begin
 if not private.is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 foreach t in array array['profiles','items','bookings','payments','handovers','reviews','disputes','notifications','item_images','item_availability','user_roles','admin_audit_logs'] loop
  execute format('select count(*) from public.%I',t) into n;
  result:=result||jsonb_build_object(t,n);
 end loop;
 return result||jsonb_build_object('open_disputes',(select count(*) from disputes where status='open'));
end $$;

-- Serialize changes affecting administrator availability, including role changes.
create or replace function public.cu_admin_set_role(p_user uuid,p_admin boolean,p_reason text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor(); old_role jsonb;
begin
 if not private.is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 if p_admin is null or p_reason is null or char_length(trim(p_reason)) not between 5 and 2000 then raise exception 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร'; end if;
 perform pg_advisory_xact_lock(hashtext('cu-borrow-admin-availability'));
 if not private.is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 if not exists(select 1 from profiles where id=p_user) then raise exception 'ไม่พบผู้ใช้'; end if;
 select to_jsonb(r) into old_role from user_roles r where user_id=p_user;
 if p_admin then
  if not exists(select 1 from profiles p join auth.users a on a.id=p.id where p.id=p_user and not p.suspended and a.email_confirmed_at is not null) then raise exception 'Admin ต้องเป็นบัญชีที่ยืนยันอีเมลและไม่ถูกระงับ'; end if;
  insert into user_roles(user_id,role) values(p_user,'admin') on conflict(user_id) do nothing;
 else
  if exists(select 1 from user_roles where user_id=p_user) and not exists(select 1 from user_roles r join profiles p on p.id=r.user_id join auth.users a on a.id=p.id where r.user_id<>p_user and not p.suspended and a.email_confirmed_at is not null) then raise exception 'ต้องเหลือ Admin ที่ใช้งานได้อย่างน้อยหนึ่งบัญชี'; end if;
  delete from user_roles where user_id=p_user;
 end if;
 insert into admin_audit_logs(admin_id,action,target_id,detail,before_data,after_data) values(u,'set_admin_role',p_user,trim(p_reason),old_role,case when p_admin then jsonb_build_object('user_id',p_user,'role','admin') else null end);
end $$;

create or replace function public.cu_admin_patch(p_table text,p_id uuid,p_patch jsonb,p_reason text,p_expected jsonb default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor(); allowed text[]; fields text[]; assignments text; before_row jsonb; after_row jsonb; b bookings; h handovers; img item_images; blocked item_availability;
begin
 if not private.is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 allowed:=private.admin_columns(p_table);
 if allowed is null or cardinality(allowed)=0 or p_id is null then raise exception 'ตารางนี้แก้ไขผ่านช่องทางนี้ไม่ได้'; end if;
 if p_reason is null or char_length(trim(p_reason)) not between 5 and 2000 or p_patch is null or jsonb_typeof(p_patch)<>'object' or octet_length(p_patch::text)>20000 then raise exception 'ข้อมูลหรือเหตุผลไม่ถูกต้อง'; end if;
 select array_agg(k order by k) into fields from jsonb_object_keys(p_patch) k;
 if fields is null or not fields <@ allowed then raise exception 'มีฟิลด์ที่ไม่อนุญาตให้แก้ไข'; end if;
 -- Consistent advisory lock order also prevents concurrent removal of the final admin.
 if p_table='profiles' then perform pg_advisory_xact_lock(hashtext('cu-borrow-admin-availability')); if not private.is_admin() then raise exception 'Admin only' using errcode='42501'; end if; end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1 for update',p_table) into before_row using p_id;
 if before_row is null then raise exception 'ไม่พบข้อมูล'; end if;
 if p_expected is not null and exists(select 1 from unnest(fields) k where before_row->k is distinct from p_expected->k) then raise exception 'ข้อมูลนี้เปลี่ยนแล้ว กรุณารีเฟรชก่อนบันทึก' using errcode='40001'; end if;
 if p_table='payments' and not (before_row->>'simulated')::boolean then raise exception 'ข้อมูลเงินจริงต้องได้รับการยืนยันจาก Payment Gateway'; end if;
 select string_agg(format('%I=v.%I',k,k),',') into assignments from unnest(fields) k;
 execute format('update public.%1$I t set %2$s from jsonb_populate_record(null::public.%1$I,$1) v where t.id=$2 returning to_jsonb(t)',p_table,assignments) into after_row using p_patch,p_id;

 if p_table='profiles' and (after_row->>'suspended')::boolean and exists(select 1 from user_roles where user_id=p_id) and not exists(select 1 from user_roles r join profiles p on p.id=r.user_id join auth.users a on a.id=p.id where r.user_id<>p_id and not p.suspended and a.email_confirmed_at is not null) then raise exception 'ต้องเหลือ Admin ที่ใช้งานได้อย่างน้อยหนึ่งบัญชี'; end if;
 if p_table='items' then
  if exists(select 1 from bookings where item_id=p_id and status not in ('cancelled','completed') and (start_date<(after_row->>'available_from')::date or end_date>(after_row->>'available_until')::date)) then raise exception 'ช่วงวันที่ใหม่ไม่ครอบคลุมรายการเช่าที่ค้างอยู่'; end if;
  update items set updated_at=now() where id=p_id;
 end if;
 if p_table='item_images' then
  select * into img from item_images where id=p_id;
  if not exists(select 1 from storage.objects where bucket_id='item-images' and name=img.storage_path) then raise exception 'ไม่พบภาพใน Storage'; end if;
 end if;
 if p_table='item_availability' then
  select * into blocked from item_availability where id=p_id;
  if exists(select 1 from bookings where item_id=blocked.item_id and status not in ('completed','cancelled') and daterange(start_date,end_date,'[]') && daterange(blocked.start_date,blocked.end_date,'[]')) then raise exception 'ช่วงวันไม่ว่างทับรายการจอง'; end if;
 end if;
 if p_table='bookings' then
  select * into b from bookings where id=p_id;
  if (p_patch?'item_id' or p_patch?'owner_id') and not exists(select 1 from items where id=b.item_id and owner_id=b.owner_id) then raise exception 'เจ้าของรายการเช่าต้องตรงกับเจ้าของสินค้า'; end if;
  if exists(select 1 from payments where booking_id=b.id and not simulated) and (b.daily_price<>(before_row->>'daily_price')::numeric or b.deposit<>(before_row->>'deposit')::numeric or b.platform_fee<>(before_row->>'platform_fee')::numeric or b.start_date<>(before_row->>'start_date')::date or b.end_date<>(before_row->>'end_date')::date) then raise exception 'ยอดเงินจริงต้องปรับผ่าน Payment Gateway'; end if;
  if b.status in ('paid','picked_up','returned','completed') and not exists(select 1 from payments where booking_id=b.id and status<>'refunded' and (simulated or provider_reference is not null)) then raise exception 'ต้องมีรายการชำระที่ตรวจสอบได้ก่อนเปลี่ยนสถานะนี้'; end if;
  if b.status in ('picked_up','returned','completed') and (select count(distinct user_id) from handovers where booking_id=b.id and kind='pickup' and user_id in (b.owner_id,b.renter_id))<>2 then raise exception 'ยังยืนยันรับของไม่ครบสองฝ่าย'; end if;
  if b.status in ('returned','completed') and (select count(distinct user_id) from handovers where booking_id=b.id and kind='return' and user_id in (b.owner_id,b.renter_id))<>2 then raise exception 'ยังยืนยันคืนของไม่ครบสองฝ่าย'; end if;
  if b.status='disputed' and not exists(select 1 from disputes where booking_id=b.id and status='open') then
   if before_row->>'status' not in ('confirmed','paid','picked_up','returned') then raise exception 'เปิดข้อพิพาทในสถานะนี้ไม่ได้'; end if;
   insert into disputes(booking_id,opened_by,reason,previous_status) values(b.id,u,trim(p_reason),before_row->>'status');
  end if;
  if b.status='cancelled' and exists(select 1 from payments where booking_id=b.id and not simulated and status<>'refunded') then raise exception 'ต้องยืนยันการคืนเงินจริงผ่าน Payment Gateway ก่อน'; end if;
  update bookings set rental_total=daily_price*(end_date-start_date+1),updated_at=now() where id=b.id returning * into b;
  update payments set amount=b.rental_total+b.deposit+b.platform_fee,deposit_amount=b.deposit,status=case b.status when 'cancelled' then 'refunded' when 'completed' then 'released' when 'disputed' then 'held' else 'simulated' end,updated_at=now() where booking_id=b.id and simulated;
  if before_row->>'status'='disputed' and b.status<>'disputed' then update disputes set status='resolved',resolution=trim(p_reason),resolved_by=u,resolved_at=now() where booking_id=b.id and status='open'; end if;
  perform private.notify(b,'Admin ปรับปรุงรายการเช่า: '||trim(p_reason));
 end if;
 if p_table='payments' then
  select * into b from bookings where id=(after_row->>'booking_id')::uuid;
  if (after_row->>'amount')::numeric<>b.rental_total+b.deposit+b.platform_fee or (after_row->>'deposit_amount')::numeric<>b.deposit then raise exception 'ยอดเงินต้องตรงกับการจอง กรุณาปรับจากรายการจอง'; end if;
  if after_row->>'status'<>(case b.status when 'cancelled' then 'refunded' when 'completed' then 'released' when 'disputed' then 'held' else 'simulated' end) then raise exception 'สถานะเงินต้องตรงกับการจอง'; end if;
 end if;
 if p_table='handovers' then
  select * into h from handovers where id=p_id;
  if h.evidence_path not like h.user_id::text||'/'||h.booking_id::text||'/'||h.kind||'/%' or not exists(select 1 from storage.objects where bucket_id='handover-evidence' and name=h.evidence_path) then raise exception 'หลักฐานต้องเป็นภาพของผู้ยืนยันในรายการนี้'; end if;
 end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1',p_table) into after_row using p_id;
 insert into admin_audit_logs(admin_id,action,target_id,detail,before_data,after_data) values(u,'edit_'||p_table,p_id,trim(p_reason),before_row,after_row);
 return after_row;
end $$;

-- Keep existing moderation endpoints on the same audited implementation.
create or replace function public.cu_admin(p_action text,p_target uuid,p_detail text,p_value text default '') returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor(); d disputes; b bookings;
begin
 if not private.is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 if p_action='suspend_user' then
  if p_value not in ('true','false') then raise exception 'Invalid suspension value'; end if;
  perform cu_admin_patch('profiles',p_target,jsonb_build_object('suspended',p_value::boolean),p_detail);
 elsif p_action='moderate_item' then
  if p_value not in ('active','suspended') then raise exception 'Invalid listing status'; end if;
  perform cu_admin_patch('items',p_target,jsonb_build_object('status',p_value),p_detail);
 elsif p_action='resolve_dispute' then
  select booking_id into b.id from disputes where id=p_target;
  select * into b from bookings where id=b.id for update;
  select * into d from disputes where id=p_target and status='open' for update;
  if d.id is null or b.status<>'disputed' or p_value not in ('resume','cancel') then raise exception 'ข้อพิพาทไม่พร้อมแก้ไข'; end if;
  perform cu_admin_patch('bookings',b.id,jsonb_build_object('status',case p_value when 'cancel' then 'cancelled' else d.previous_status end),p_detail);
 else raise exception 'Invalid admin operation'; end if;
end $$;

-- Deletion preserves financial and rental history. Simple metadata can be removed.
create or replace function public.cu_admin_remove(p_table text,p_id uuid,p_reason text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor(); old_row jsonb;
begin
 if not private.is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 if p_reason is null or char_length(trim(p_reason)) not between 5 and 2000 then raise exception 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร'; end if;
 if p_table='items' then perform cu_admin_patch('items',p_id,jsonb_build_object('status','archived'),p_reason);return; end if;
 if p_table='profiles' then perform cu_admin_patch('profiles',p_id,jsonb_build_object('suspended',true),p_reason);return; end if;
 if p_table='bookings' then perform cu_admin_patch('bookings',p_id,jsonb_build_object('status','cancelled'),p_reason);return; end if;
 if p_table not in ('reviews','notifications','item_images','item_availability') then raise exception 'ข้อมูลประวัติประเภทนี้ต้องเก็บไว้เพื่อตรวจสอบ'; end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1 for update',p_table) into old_row using p_id;
 if old_row is null then raise exception 'ไม่พบข้อมูล'; end if;
 execute format('delete from public.%I where id=$1',p_table) using p_id;
 insert into admin_audit_logs(admin_id,action,target_id,detail,before_data) values(u,'remove_'||p_table,p_id,trim(p_reason),old_row);
end $$;

-- Creates owner listings/blackouts and in-app notices without arbitrary SQL access.
create or replace function public.cu_admin_create(p_table text,p_data jsonb,p_reason text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor(); fields text[]; allowed text[]; cols text; vals text; new_id uuid; row_json jsonb; blocked item_availability;
begin
 if not private.is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 if p_table not in ('items','item_availability','notifications') or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>20000 then raise exception 'ประเภทข้อมูลที่สร้างไม่ถูกต้อง'; end if;
 if p_reason is null or char_length(trim(p_reason)) not between 5 and 2000 then raise exception 'กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร'; end if;
 allowed:=private.admin_columns(p_table);select array_agg(k order by k) into fields from jsonb_object_keys(p_data) k;
 if fields is null or not fields <@ allowed then raise exception 'มีฟิลด์ที่ไม่อนุญาต'; end if;
 select string_agg(format('%I',k),','),string_agg(format('v.%I',k),',') into cols,vals from unnest(fields) k;
 execute format('insert into public.%1$I (%2$s) select %3$s from jsonb_populate_record(null::public.%1$I,$1) v returning id,to_jsonb(%1$I)',p_table,cols,vals) into new_id,row_json using p_data;
 if p_table='item_availability' then
  select * into blocked from item_availability where id=new_id;
  if exists(select 1 from bookings where item_id=blocked.item_id and status not in ('completed','cancelled') and daterange(start_date,end_date,'[]') && daterange(blocked.start_date,blocked.end_date,'[]')) then raise exception 'ช่วงวันไม่ว่างทับรายการจอง'; end if;
 end if;
 insert into admin_audit_logs(admin_id,action,target_id,detail,after_data) values(u,'create_'||p_table,new_id,trim(p_reason),row_json);
 return new_id;
end $$;

create or replace function public.cu_admin_files(p_bucket text,p_search text default '',p_page integer default 1,p_size integer default 20) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u uuid:=private.actor(); result jsonb; total bigint;
begin
 if not private.is_admin() then raise exception 'Admin only' using errcode='42501'; end if;
 if p_bucket not in ('item-images','handover-evidence') or p_page<1 or p_size not between 1 and 50 or char_length(p_search)>200 then raise exception 'Invalid storage query'; end if;
 select count(*) into total from storage.objects where bucket_id=p_bucket and (p_search='' or name ilike '%'||p_search||'%');
 select coalesce(jsonb_agg(row),'[]'::jsonb) into result from (
  select jsonb_build_object('id',id,'name',name,'bucket_id',bucket_id) as row from storage.objects where bucket_id=p_bucket and (p_search='' or name ilike '%'||p_search||'%') order by name,id limit p_size offset (p_page-1)::bigint*p_size
 ) s;
 return jsonb_build_object('rows',result,'total',total,'page',p_page,'size',p_size);
end $$;

-- Read application records as an administrator; normal-user column grants are unchanged.
do $$ declare t text; begin
 foreach t in array array['profiles','items','item_images','item_availability','bookings','payments','handovers','reviews','disputes','notifications','user_roles','admin_audit_logs'] loop
  execute format('create policy admin_read_all on public.%I for select to authenticated using(private.is_admin())',t);
 end loop;
end $$;
create policy admin_storage_read_all on storage.objects for select to authenticated using(bucket_id in ('item-images','handover-evidence') and private.is_admin());
create policy rental_participant_item_read on items for select to authenticated using(exists(select 1 from bookings where item_id=items.id and auth.uid() in (owner_id,renter_id)));

revoke all on function private.admin_columns(text) from public,anon,authenticated;
revoke all on function public.cu_admin_me(),public.cu_admin_rows(text,text,integer,integer),public.cu_admin_summary(),public.cu_admin_set_role(uuid,boolean,text),public.cu_admin_patch(text,uuid,jsonb,text,jsonb),public.cu_admin_remove(text,uuid,text),public.cu_admin_create(text,jsonb,text),public.cu_admin_files(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.cu_admin_me(),public.cu_admin_rows(text,text,integer,integer),public.cu_admin_summary(),public.cu_admin_set_role(uuid,boolean,text),public.cu_admin_patch(text,uuid,jsonb,text,jsonb),public.cu_admin_remove(text,uuid,text),public.cu_admin_create(text,jsonb,text),public.cu_admin_files(text,text,integer,integer) to authenticated;

notify pgrst, 'reload schema';
commit;
