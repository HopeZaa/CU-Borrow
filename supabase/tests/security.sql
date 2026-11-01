\set ON_ERROR_STOP on
begin;
create schema test;
create function test.ok(b boolean,msg text) returns void language plpgsql as $$ begin if b is distinct from true then raise exception 'FAIL: %',msg;end if;raise notice 'PASS: %',msg;end $$;
create function test.reject(query text,msg text) returns void language plpgsql as $$ begin begin execute query; exception when others then raise notice 'PASS: % (%)',msg,sqlerrm;return;end;raise exception 'FAIL: % (unexpected success)',msg;end $$;
grant usage on schema test to anon,authenticated,service_role;
grant execute on all functions in schema test to anon,authenticated,service_role;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000001','owner@test.invalid',now(),'{"display_name":"Owner"}'),
 ('00000000-0000-0000-0000-000000000002','renter@test.invalid',now(),'{"display_name":"Renter"}'),
 ('00000000-0000-0000-0000-000000000003','other@test.invalid',now(),'{"display_name":"Other"}'),
 ('00000000-0000-0000-0000-000000000004','admin@test.invalid',now(),'{"display_name":"Admin"}'),
 ('00000000-0000-0000-0000-000000000005','unconfirmed@test.invalid',null,'{"display_name":"Unconfirmed"}');
insert into user_roles values('00000000-0000-0000-0000-000000000004','admin');
select test.ok((select count(*)=5 from profiles),'signup trigger creates profiles');
select test.ok((select bool_and(verification_status='unverified') from profiles),'email never grants student verification');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select cu_save_item(null,'Test camera','Camera in good condition with lens and strap','camera','good',100.50,1000,'Central library',current_date,current_date+180) as item_id \gset
select test.reject(format('update profiles set verification_status=''verified'' where id=%L',auth.uid()),'cannot self-verify');
select test.reject(format('update profiles set suspended=true where id=%L',auth.uid()),'cannot set suspension');
select test.reject(format('insert into user_roles values(%L,''admin'')',auth.uid()),'cannot self-promote admin');
select test.reject(format('select cu_book(%L,current_date,current_date+1)',:'item_id'),'owner cannot rent own item');
select cu_blackout(:'item_id',current_date+10,current_date+12);
select test.ok((select count(*)=1 from cu_unavailable(:'item_id')),'availability exposes periods only');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
select test.reject(format('select cu_book(%L,current_date,current_date+1)',:'item_id'),'unconfirmed email cannot book');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select test.reject(format('select cu_book(%L,current_date+11,current_date+13)',:'item_id'),'blocked dates rejected by server');
select test.reject(format('select cu_book(%L,current_date-1,current_date)',:'item_id'),'past dates rejected');
select test.reject(format('select cu_book(%L,current_date+2,current_date+1)',:'item_id'),'reversed dates rejected');
select cu_book(:'item_id',current_date,current_date+1) as booking_id \gset
select test.ok((select rental_days=2 and rental_total=201 and deposit=1000 and platform_fee=0 from bookings where id=:'booking_id'),'inclusive days and server price snapshots');
select test.reject(format('update bookings set daily_price=1,status=''paid'' where id=%L',:'booking_id'),'renter cannot change price or payment status');
select test.reject(format('select cu_transition(%L,''confirm'')',:'booking_id'),'renter cannot confirm request');
select test.reject(format('select cu_review(%L,5,''Great rental'')',:'booking_id'),'cannot review unfinished booking');
select test.reject(format('select cu_simulate_payment(%L,%L)',:'booking_id',auth.uid()),'client cannot invoke simulated payment RPC');
select test.reject(format('select cu_book(%L,current_date+1,current_date+3)',:'item_id'),'overlap rejected including return day');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select test.ok((select count(*)=0 from bookings),'other user cannot read bookings');
update profiles set display_name='Hacked name' where id='00000000-0000-0000-0000-000000000001';
select test.ok((select display_name='Owner' from profiles where id='00000000-0000-0000-0000-000000000001'),'other user cannot edit profile');
select test.reject(format('select cu_transition(%L,''cancel'')',:'booking_id'),'other user cannot cancel');
select test.reject(format('select cu_save_item(%L,''Changed title'',''Trying to change someone else listing'',''camera'',''good'',1,0,''Campus'',current_date,current_date+180)',:'item_id'),'other user cannot edit listing');
select test.reject(format('select cu_admin(''suspend_user'',%L,''Test reason'',''true'')','00000000-0000-0000-0000-000000000001'),'other user cannot administer');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select cu_save_item(:'item_id','Test camera','Camera in good condition with lens and strap','camera','good',500,2000,'Central library',current_date,current_date+180);
select test.ok((select rental_total=201 and deposit=1000 from bookings where id=:'booking_id'),'listing edits never mutate agreed price');
select test.reject(format('select cu_blackout(%L,current_date,current_date+1)',:'item_id'),'blackout cannot cover existing reservation');
select test.reject(format('select cu_archive_item(%L)',:'item_id'),'active reservation prevents archive');
select cu_transition(:'booking_id','confirm');
select test.reject(format('select cu_transition(%L,''confirm'')',:'booking_id'),'cannot confirm twice');
select test.reject(format('select cu_handover(%L,''pickup'',''fake'')',:'booking_id'),'cannot skip payment');
reset role;
select set_config('request.jwt.claim.role','service_role',true);
select cu_simulate_payment(:'booking_id','00000000-0000-0000-0000-000000000002');
select test.ok((select provider='development' and simulated and amount=1201 from payments where booking_id=:'booking_id'),'payment explicitly simulated and correct total');
select test.reject(format('select cu_simulate_payment(%L,%L)',:'booking_id','00000000-0000-0000-0000-000000000002'),'duplicate simulated payment rejected');
insert into storage.objects(bucket_id,name) values
 ('handover-evidence','00000000-0000-0000-0000-000000000001/'||:'booking_id'||'/pickup/a.jpg'),
 ('handover-evidence','00000000-0000-0000-0000-000000000002/'||:'booking_id'||'/pickup/a.jpg'),
 ('handover-evidence','00000000-0000-0000-0000-000000000001/'||:'booking_id'||'/return/a.jpg'),
 ('handover-evidence','00000000-0000-0000-0000-000000000002/'||:'booking_id'||'/return/a.jpg');
set local role authenticated;
select cu_handover(:'booking_id','pickup','00000000-0000-0000-0000-000000000001/'||:'booking_id'||'/pickup/a.jpg');
select test.ok((select status='paid' from bookings where id=:'booking_id'),'one confirmation does not finish handover');
select test.reject(format('select cu_handover(%L,''pickup'',%L)',:'booking_id','00000000-0000-0000-0000-000000000001/'||:'booking_id'||'/pickup/a.jpg'),'cannot confirm handover twice');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select test.reject(format('select cu_handover(%L,''pickup'',%L)',:'booking_id','00000000-0000-0000-0000-000000000001/'||:'booking_id'||'/pickup/a.jpg'),'cannot submit another party evidence');
select cu_handover(:'booking_id','pickup','00000000-0000-0000-0000-000000000002/'||:'booking_id'||'/pickup/a.jpg');
select test.ok((select status='picked_up' from bookings where id=:'booking_id'),'two confirmations advance pickup');
select cu_dispute(:'booking_id','Item has an unexpected problem');
select test.ok((select status='held' from payments where booking_id=:'booking_id'),'dispute holds payment');
select test.reject(format('select cu_transition(%L,''complete'')',:'booking_id'),'dispute blocks completion');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select id as dispute_id from disputes where booking_id=:'booking_id' \gset
select cu_admin('resolve_dispute',:'dispute_id','Resolved after inspecting all evidence','resume');
select test.ok((select status='picked_up' from bookings where id=:'booking_id'),'admin resolution restores previous state');
select test.ok((select count(*)=1 from admin_audit_logs),'admin action audit recorded');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select cu_handover(:'booking_id','return','00000000-0000-0000-0000-000000000001/'||:'booking_id'||'/return/a.jpg');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select cu_handover(:'booking_id','return','00000000-0000-0000-0000-000000000002/'||:'booking_id'||'/return/a.jpg');
select cu_transition(:'booking_id','complete');
select cu_review(:'booking_id',5,'Excellent rental experience');
select test.ok((select rating=5 and review_count=1 and completed_count=1 from owner_stats where id='00000000-0000-0000-0000-000000000001'),'review and completed rental aggregates');
select test.reject(format('select cu_review(%L,5,''Duplicate review'')',:'booking_id'),'one review per actual rental');
select cu_book(:'item_id',current_date+20,current_date+21) as cancelled_id \gset
select cu_transition(:'cancelled_id','cancel');
select cu_book(:'item_id',current_date+20,current_date+21);
select test.ok(true,'cancellation releases date reservation');
select test.ok((select count(*)>0 from notifications),'participant notifications persisted');
reset role;
set local role anon;
select test.ok((select count(*)=1 from items),'anonymous users can read active catalog');
select test.reject('select * from bookings','anonymous users cannot read bookings');
select test.reject(format('select cu_book(%L,current_date+30,current_date+31)',:'item_id'),'anonymous users cannot reserve');
rollback;
