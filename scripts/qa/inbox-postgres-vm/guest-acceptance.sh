#!/bin/sh
# Isolated synthetic PostgreSQL acceptance only; executed as guest postgres UID70.
set -eu
export PATH=/usr/libexec/postgresql17:/bin:/sbin:/usr/bin:/usr/sbin
export LC_ALL=C
export PGHOST=/run/pg PGUSER=postgres PGDATABASE=postgres PAGER=cat PSQL_PAGER=cat
CID=conv_aaaaaaaaaaaaaaaaaaaaaaaa
OTHER=conv_bbbbbbbbbbbbbbbbbbbbbbbb
DIGEST=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
SECOND=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
A=00000000-0000-4000-8000-000000000001
B=00000000-0000-4000-8000-000000000002
C=00000000-0000-4000-8000-000000000003
passes=0
case_name=bootstrap
sql(){ psql -X -qAt -v ON_ERROR_STOP=1 -c "$1"; }
fail(){ printf 'KK_CASE {"name":"%s","status":"FAIL"}\n' "$case_name"; exit 1; }
trap 'printf "KK_GUEST_EXIT %s\n" "$?"' EXIT
assert_sql(){ [ "$(sql "select coalesce(($1),false)")" = t ] || fail; }
pass(){ passes=$((passes+1)); printf 'KK_CASE {"name":"%s","status":"PASS"}\n' "$case_name"; }
wait_sql(){
 end=$(( $(date +%s)+25 ));
 while [ "$(sql "select coalesce(($1),false)")" != t ]; do
  [ "$(date +%s)" -lt "$end" ] || fail
  sleep 0.05
 done
}
reserve_expr(){ printf "public.kk_inbox_reserve_outbound('%s','%s','%s',%s,'%s')" "$1" "${2:-$CID}" "${3:-$DIGEST}" "${4:-null}" "${5:-}"; }
reserve(){ sql "set role service_role;select $(reserve_expr "$@")"; }
reset(){
 sql "truncate kk_private.inbox_outbound_attempts,kk_private.inbox_messages,kk_private.inbox_conversations,kk_private.inbox_audit,qa.provider_calls restart identity cascade;insert into kk_private.inbox_conversations(conversation_id,channel,external_user_id) values('$CID','line','Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),('$OTHER','line','Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');" >/dev/null
}
holder(){
 rm -f /tmp/holder-input /tmp/holder.out /tmp/holder.err
 mkfifo /tmp/holder-input
 PGAPPNAME=kk_qa_holder psql -X -qAt -v ON_ERROR_STOP=1 </tmp/holder-input >/tmp/holder.out 2>/tmp/holder.err & holder_job=$!
 exec 3>/tmp/holder-input
 printf 'begin;set local role service_role;select %s;\n' "$(reserve_expr "$@")" >&3
 wait_sql "exists(select 1 from pg_stat_activity where application_name='kk_qa_holder' and state='idle in transaction')"
}
waiter(){
 rm -f /tmp/waiter.out /tmp/waiter.err /tmp/waiter.done
 (PGAPPNAME=kk_qa_waiter psql -X -qAt -v ON_ERROR_STOP=1 -c "set role service_role;select $(reserve_expr "$@")" >/tmp/waiter.out 2>/tmp/waiter.err; touch /tmp/waiter.done) & waiter_job=$!
}
observe_wait(){
 end=$(( $(date +%s)+25 ))
 while [ "$(sql "select exists(select 1 from pg_stat_activity where application_name='kk_qa_waiter' and wait_event_type='Lock' and wait_event='advisory')")" != t ]; do
  [ ! -e /tmp/waiter.done ] || fail
  [ "$(date +%s)" -lt "$end" ] || fail
  sleep 0.05
 done
 assert_sql "(select count(distinct pid)=2 from pg_stat_activity where application_name in ('kk_qa_holder','kk_qa_waiter'))"
 assert_sql "exists(select 1 from pg_locks h,pg_locks w,pg_stat_activity a,pg_stat_activity b where a.application_name='kk_qa_holder' and b.application_name='kk_qa_waiter' and h.pid=a.pid and w.pid=b.pid and h.locktype='advisory' and w.locktype='advisory' and h.granted and not w.granted and h.classid=w.classid and h.objid=w.objid and h.objsubid=1 and w.objsubid=1 and h.classid::bigint=((hashtextextended('$CID:$DIGEST',0)>>32)&4294967295) and h.objid::bigint=(hashtextextended('$CID:$DIGEST',0)&4294967295))"
 sql "select 'KK_LOCK '||json_build_object('holder_pid',h.pid,'waiter_pid',w.pid,'waiter_event',w.wait_event,'blocked_by_holder',h.pid=any(pg_blocking_pids(w.pid)))::text from pg_stat_activity h,pg_stat_activity w where h.application_name='kk_qa_holder' and w.application_name='kk_qa_waiter'"
 assert_sql "exists(select 1 from pg_stat_activity h,pg_stat_activity w where h.application_name='kk_qa_holder' and w.application_name='kk_qa_waiter' and h.pid=any(pg_blocking_pids(w.pid)))"
}
release(){ printf '%s;\n' "$1" >&3;exec 3>&-;wait "$holder_job";wait "$waiter_job"; }
restart(){
 pg_ctl -D /tmp/pg -m immediate -w stop >/dev/null
 cluster_state=$(pg_controldata /tmp/pg | sed -n 's/^Database cluster state: *//p')
 [ "$cluster_state" = 'in production' ] || fail
 pg_ctl -D /tmp/pg -l /tmp/pg.log -w start >/dev/null
 printf 'KK_CRASH {"unclean_control_state":"%s","mode":"immediate","restarted":true}\n' "$cluster_state"
 assert_sql "current_setting('fsync')='on' and current_setting('synchronous_commit')='on'"
}
provider(){ sql "insert into qa.provider_calls(request_id) values('$1')" >/dev/null; }
record(){
 sql "set role service_role;select * from public.kk_inbox_record_outbound(jsonb_build_object('message_id','msg_cccccccccccccccccccccccc','conversation_id','$CID','channel','line','external_user_id','Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','external_message_id','synthetic-provider','text','Synthetic VM acceptance only','send_authorized',true,'authorized_by','owner','outbound_request_id','$A','retry_key',(select retry_key::text from kk_private.inbox_outbound_attempts where request_id='$A'),'provider_request_id','synthetic-provider-request','sent_at','2026-10-16T07:00:00.000Z'))" >/dev/null
}
finish(){ sql "set role service_role;select public.kk_inbox_finish_outbound('$A','SENT','synthetic-provider','synthetic-provider-request')" >/dev/null; }
review(){ sql "set role service_role;select public.kk_inbox_review_outbound('$CID','$A','VERIFIED_SENT','LINE-OA:synthetic-proof','Synthetic owner review')" >/dev/null; }
held(){ result=$(reserve "$B");case "$result" in *'"allowed": false'*) ;; *)fail;;esac; }

case_name='native PostgreSQL17 under UID70 with no TCP listener and durable commit settings'
[ "$(id -u)" = 70 ] || fail
assert_sql "current_setting('server_version_num')::integer>=170000 and current_setting('server_version_num')::integer<180000 and current_setting('listen_addresses')='' and inet_server_addr() is null and current_setting('fsync')='on' and current_setting('synchronous_commit')='on'"
sql "select 'KK_ENGINE '||json_build_object('version',version(),'backend_pid',pg_backend_pid(),'fsync',current_setting('fsync'),'synchronous_commit',current_setting('synchronous_commit'),'listen_addresses',current_setting('listen_addresses'))::text"
[ "$(ls /sys/class/net)" = lo ] || fail
pass

# Same source SQL and storage schema fixture as embedded acceptance; no hosted API.
sql 'create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create schema qa;create table qa.provider_calls(request_id uuid primary key);' >/dev/null
for file in /qa/source/*.sql; do psql -X -qAt -v ON_ERROR_STOP=1 -f "$file" >/dev/null; done
case_name='source compilation RLS and all Inbox RPC privilege boundaries'
assert_sql "(select count(*)>=13 from pg_proc where proname like 'kk_inbox_%')"
assert_sql "not exists(select 1 from pg_proc where proname like 'kk_inbox_%' and (has_function_privilege('anon',oid,'EXECUTE') or has_function_privilege('authenticated',oid,'EXECUTE') or not has_function_privilege('service_role',oid,'EXECUTE')))"
assert_sql "(select count(*)=4 and bool_and(relrowsecurity) from pg_class where relnamespace='kk_private'::regnamespace and relkind='r')"
if sql "set role anon;select * from kk_private.inbox_conversations" >/tmp/denied.out 2>&1;then fail;fi
if sql "set role authenticated;select $(reserve_expr "$A")" >/tmp/denied.out 2>&1;then fail;fi
pass

case_name='independent sessions wait on exact advisory lock then commit permits one reservation'
reset;holder "$A";waiter "$B";observe_wait;release commit
assert_sql "(select count(*)=1 and min(request_id::text)='$A' from kk_private.inbox_outbound_attempts)"
grep -q '"allowed": true' /tmp/holder.out || fail
grep -q 'UNRESOLVED_OUTBOUND_IN_WINDOW' /tmp/waiter.out || fail
pass

case_name='rollback releases advisory lock and waiting new request becomes sole winner'
reset;holder "$A";waiter "$B";observe_wait;release rollback
assert_sql "(select count(*)=1 and min(request_id::text)='$B' from kk_private.inbox_outbound_attempts)"
grep -q '"allowed": true' /tmp/waiter.out || fail;pass

case_name='backend termination rolls back uncommitted reservation and releases waiter'
reset;holder "$A";waiter "$B";observe_wait
assert_sql "(select pg_terminate_backend(pid) from pg_stat_activity where application_name='kk_qa_holder')"
exec 3>&-;wait "$holder_job" || :
# An idle psql reading EOF may exit0 after server termination. Verify the server
# identity and rolled-back transaction, not that client-side exit convention.
assert_sql "not exists(select 1 from pg_stat_activity where application_name='kk_qa_holder')"
wait "$waiter_job"
assert_sql "(select count(*)=1 and min(request_id::text)='$B' from kk_private.inbox_outbound_attempts)";pass

case_name='same request UUID on independent sessions cannot reserve twice'
reset;holder "$A";waiter "$A";observe_wait;release commit
assert_sql "(select count(*)=1 from kk_private.inbox_outbound_attempts)"
grep -q ALREADY_RESERVED /tmp/waiter.out || fail;pass

case_name='different body fingerprint completes while first transaction remains open'
reset;holder "$A";reserve "$B" "$CID" "$SECOND" >/tmp/independent.out
assert_sql "(select count(*)=1 and min(request_id::text)='$B' from kk_private.inbox_outbound_attempts)"
assert_sql "exists(select 1 from pg_stat_activity where application_name='kk_qa_holder' and state='idle in transaction')"
printf 'rollback;\n' >&3;exec 3>&-;wait "$holder_job";pass

case_name='different conversation completes while first transaction remains open'
reset;holder "$A";reserve "$B" "$OTHER" >/tmp/independent.out
assert_sql "(select count(*)=1 and min(conversation_id)='$OTHER' from kk_private.inbox_outbound_attempts)"
printf 'rollback;\n' >&3;exec 3>&-;wait "$holder_job";pass

case_name='eight simultaneous independent backend requests create one reservation'
reset
jobs=''
for n in 11 12 13 14 15 16 17 18;do
 id=00000000-0000-4000-8000-0000000000$n
 PGAPPNAME=kk_qa_burst_$n psql -X -qAt -v ON_ERROR_STOP=1 -c "set role service_role;select 'KK_BURST '||json_build_object('pid',pg_backend_pid(),'reservation',$(reserve_expr "$id"))::text" >/tmp/burst_$n.out 2>/tmp/burst_$n.err & jobs="$jobs $!"
done
for job in $jobs;do wait "$job";done
cat /tmp/burst_*.out
assert_sql "(select count(*)=1 from kk_private.inbox_outbound_attempts)"
[ "$(grep -h '"allowed": true' /tmp/burst_*.out | wc -l | tr -d ' ')" = 1 ] || fail;pass

case_name='committed RESERVED survives immediate server crash and blocks new send'
reset;reserve "$A" >/dev/null;restart;held
assert_sql "(select status='RESERVED' from kk_private.inbox_outbound_attempts where request_id='$A')"
assert_sql "(select count(*)=0 from qa.provider_calls)";pass

case_name='crash after synthetic provider before persistence preserves unresolved hold'
reset;reserve "$A" >/dev/null;provider "$A";restart;held
assert_sql "(select count(*)=1 from qa.provider_calls) and (select count(*)=0 from kk_private.inbox_messages) and (select status='RESERVED' from kk_private.inbox_outbound_attempts where request_id='$A')";pass

case_name='crash after message persistence before finish keeps receipt and blocks replay'
reset;reserve "$A" >/dev/null;provider "$A";record;restart;held
assert_sql "(select count(*)=1 from qa.provider_calls) and (select count(*)=1 from kk_private.inbox_messages) and (select status='RESERVED' from kk_private.inbox_outbound_attempts where request_id='$A')"
finish;assert_sql "(select status='SENT' and provider_message_id='synthetic-provider' from kk_private.inbox_outbound_attempts where request_id='$A')";pass

case_name='committed SENT and provider evidence survive immediate server crash'
reset;reserve "$A" >/dev/null;provider "$A";record;finish;restart;held
assert_sql "(select status='SENT' and provider_message_id='synthetic-provider' and provider_request_id='synthetic-provider-request' from kk_private.inbox_outbound_attempts where request_id='$A') and (select count(*)=1 from qa.provider_calls)";pass

case_name='owner verified evidence survives crash and only explicit reviewed repeat may reserve'
review;restart
held
result=$(reserve "$B" "$CID" "$DIGEST" "'$A'" 'Explicit synthetic owner repeat')
case "$result" in *'"allowed": true'*) ;; *)fail;;esac
assert_sql "(select review_status='VERIFIED_SENT' and review_evidence_ref='LINE-OA:synthetic-proof' from kk_private.inbox_outbound_attempts where request_id='$A') and (select count(*)=1 from qa.provider_calls)"
restart
result=$(reserve "$C" "$CID" "$DIGEST" "'$A'" 'Explicit synthetic owner repeat')
case "$result" in *UNRESOLVED_OUTBOUND_IN_WINDOW*) ;; *)fail;;esac;pass

case_name='simultaneous reviewed-repeat clicks remain one winner with real lock wait'
reset;reserve "$A" >/dev/null;provider "$A";record;finish;review
holder "$B" "$CID" "$DIGEST" "'$A'" 'Explicit synthetic owner repeat'
waiter "$C" "$CID" "$DIGEST" "'$A'" 'Explicit synthetic owner repeat'
observe_wait;release commit
assert_sql "(select count(*)=2 from kk_private.inbox_outbound_attempts) and (select count(*)=1 from qa.provider_calls)"
grep -q UNRESOLVED_OUTBOUND_IN_WINDOW /tmp/waiter.out || fail;pass

printf 'KK_COMPLETE {"pass":%s,"fail":0,"multi_session_concurrency_verified":true,"postgres_process_crash_recovery_verified":true,"vm_power_loss_verified":false,"provider_sends":0,"production_writes":0,"release_ready":false}\n' "$passes"
