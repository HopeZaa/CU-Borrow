\set ON_ERROR_STOP on
begin;
create schema test;
create function test.ok(b boolean,msg text) returns void language plpgsql as $$ begin if b is distinct from true then raise exception 'FAIL: %',msg;end if;raise notice 'PASS: %',msg;end $$;
create function test.reject(query text,msg text) returns void language plpgsql as $$ begin begin execute query; exception when others then raise notice 'PASS: % (%)',msg,sqlerrm;return;end;raise exception 'FAIL: % (unexpected success)',msg;end $$;
grant usage on schema test to anon,authenticated;
grant execute on all functions in schema test to anon,authenticated;
insert into auth.users(id,email,email_confirmed_at) values
 ('20000000-0000-0000-0000-000000000001','owner@test.invalid',now()),
 ('20000000-0000-0000-0000-000000000002','renter@test.invalid',now()),
 ('20000000-0000-0000-0000-000000000003','other@test.invalid',now()),
 ('20000000-0000-0000-0000-000000000004','admin@test.invalid',now()),
 ('20000000-0000-0000-0000-000000000005','unconfirmed@test.invalid',null);
insert into user_roles values('20000000-0000-0000-0000-000000000004','admin');
insert into items(id,owner_id,title,description,category,condition,daily_price,deposit,pickup_location,available_from,available_until) values('20000000-0000-0000-0000-000000000010','20000000-0000-0000-0000-000000000001','Admin camera','Camera for administrator regression tests','camera','good',100,1000,'Central library',current_date,current_date+180);
insert into bookings(id,item_id,owner_id,renter_id,start_date,end_date,daily_price,rental_total,deposit) values('20000000-0000-0000-0000-000000000020','20000000-0000-0000-0000-000000000010','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',current_date,current_date+1,100,200,1000);
insert into notifications(id,user_id,message) values('20000000-0000-0000-0000-000000000030','20000000-0000-0000-0000-000000000001','Private owner notification');
insert into storage.objects(bucket_id,name) values('handover-evidence','private-orphan-evidence.jpg');
set local role anon;
select test.reject('select cu_admin_summary()','anonymous cannot access admin RPCs');
reset role;set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000003',true);
select test.ok(not cu_admin_me(),'ordinary member is not admin');
select test.reject($q$select cu_admin_rows('profiles')$q$,'member cannot read private admin records');
select test.reject($q$select cu_admin_patch('profiles','20000000-0000-0000-0000-000000000001','{"suspended":true}','Test rejection')$q$,'member cannot edit other users');
select test.reject($q$select cu_admin_set_role(auth.uid(),true,'Self promotion')$q$,'member cannot self-promote');
select test.reject($q$select cu_admin_files('handover-evidence')$q$,'member cannot list private evidence');
select test.ok((select count(*)=0 from notifications),'member cannot read others notifications');
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
select test.ok(cu_admin_me(),'confirmed active admin is recognized');
select test.ok((cu_admin_summary()->>'profiles')::int=5,'admin sees all counts');
select test.ok((cu_admin_rows('profiles','owner@test.invalid')->>'total')::int=1,'admin can search private email');
select test.ok((cu_admin_rows('profiles','',2,2)->'rows')->0->>'id' is not null,'all data accessible by pagination');
select test.ok((cu_admin_rows('notifications')->>'total')::int=1,'admin sees other users notifications');
select test.ok((cu_admin_files('handover-evidence')->>'total')::int=1,'admin sees all private evidence files');
select test.ok((select count(*)=1 from storage.objects where bucket_id='handover-evidence'),'admin storage read policy works');
select cu_admin_patch('profiles','20000000-0000-0000-0000-000000000001','{"display_name":"Updated owner","verification_status":"verified"}','Verified student card');
select test.ok((select display_name='Updated owner' and verification_status='verified' from profiles where id='20000000-0000-0000-0000-000000000001'),'admin edits another profile');
select test.ok((select before_data->>'display_name'<>after_data->>'display_name' from admin_audit_logs where action='edit_profiles'),'audit keeps before and after');
select test.reject($q$select cu_admin_patch('profiles','20000000-0000-0000-0000-000000000001','{"display_name":"Stale owner"}','Stale update','{"display_name":"Old value"}')$q$,'stale update does not overwrite new changes');
select test.reject($q$select cu_admin_patch('profiles','20000000-0000-0000-0000-000000000001','{"id":"20000000-0000-0000-0000-000000000009"}','Change identity')$q$,'immutable identity cannot be changed');
select test.reject($q$select cu_admin_rows('profiles; drop table items; --')$q$,'table injection rejected');
select test.reject($q$select cu_admin_patch('admin_audit_logs','20000000-0000-0000-0000-000000000001','{"detail":"Erased"}','Change audit')$q$,'audit history is immutable through admin RPC');
select test.reject($q$select cu_admin_set_role(auth.uid(),false,'Remove last admin')$q$,'last admin role protected');
select test.reject($q$select cu_admin_patch('profiles',auth.uid(),'{"suspended":true}','Suspend last admin')$q$,'last admin account protected');
select test.reject($q$select cu_admin_set_role('20000000-0000-0000-0000-000000000005',true,'Unconfirmed promotion')$q$,'unconfirmed account cannot become admin');
select cu_admin_set_role('20000000-0000-0000-0000-000000000003',true,'Appoint backup admin');
select test.ok((select count(*)=2 from user_roles),'admin can appoint another admin');
select cu_admin_set_role('20000000-0000-0000-0000-000000000003',false,'Remove backup admin');
select test.ok((select count(*)=1 from user_roles),'admin can revoke backup admin');
select cu_admin_patch('bookings','20000000-0000-0000-0000-000000000020','{"daily_price":150,"platform_fee":10}','Correct price agreement');
select test.ok((select rental_total=300 and platform_fee=10 from bookings where id='20000000-0000-0000-0000-000000000020'),'admin price change recomputes server total');
select test.reject($q$select cu_admin_patch('bookings','20000000-0000-0000-0000-000000000020','{"status":"paid"}','Fake payment status')$q$,'admin cannot invent payment confirmation');
select test.reject($q$select cu_admin_create('item_availability',jsonb_build_object('item_id','20000000-0000-0000-0000-000000000010','start_date',current_date,'end_date',current_date+2),'Block existing booking')$q$,'admin blackout cannot invalidate active booking');
select cu_admin_create('notifications','{"user_id":"20000000-0000-0000-0000-000000000002","message":"Admin notice","read_at":null,"booking_id":null}','Notify rental participant');
select test.ok((cu_admin_rows('notifications','Admin notice')->>'total')::int=1,'admin can create a notification');
select cu_admin_remove('notifications','20000000-0000-0000-0000-000000000030','Remove obsolete notification');
select test.ok((cu_admin_rows('notifications','Private owner notification')->>'total')::int=0,'admin can remove a notification');
select cu_admin_remove('items','20000000-0000-0000-0000-000000000010','Archive listing during investigation');
select test.ok((select status='archived' from items where id='20000000-0000-0000-0000-000000000010'),'admin archives listing preserving history');
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',true);
select test.ok((select count(*)=1 from items),'rental participant can read archived item history');
reset role;
update profiles set suspended=true where id='20000000-0000-0000-0000-000000000004';
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000004',true);
select test.ok(not cu_admin_me(),'suspended admin rejected');
select test.reject('select cu_admin_summary()','suspended admin cannot access private data');
rollback;
