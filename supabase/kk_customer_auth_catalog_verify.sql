-- KK Phone Rental PR875 customer-auth catalog verification.
-- READ ONLY: no customer/session/evidence rows are read; no customer RPC is called.
-- Owner must first select and bind an isolated staging project/branch explicitly.
-- Provider project-ref/branch-id binding is recorded outside SQL; current_database() is not project proof.
-- Run as one connection to keep READ ONLY effective. ROLLBACK ends the read-only transaction.
-- Before migration: ABSENT is a baseline, never post-migration acceptance.
-- After reviewed migration: compare fingerprints against the source-bound disposable manifest.
begin transaction read only;

-- gate: environment
select 'environment' as gate, current_database() as database_name,
       current_setting('server_version') as postgres_version,
       transaction_timestamp() as observed_at,
       current_setting('transaction_read_only') as transaction_read_only;

-- gate: roles
select 'roles' as gate, required.role_name, r.oid is not null as present,
       coalesce(r.rolbypassrls,false) as bypass_rls,
       r.rolsuper as superuser, r.rolinherit as inherits_membership_privileges
from (values ('anon'),('authenticated'),('service_role')) as required(role_name)
left join pg_roles r on r.rolname=required.role_name
order by required.role_name;

-- gate: role_memberships
-- Transitive metadata paths only. Unexpected membership/SET ROLE reachability => DBA HOLD.
with recursive membership(root_role,member_oid,role_oid,depth,path,admin_option,inherit_option,set_option) as (
 select r.rolname,r.oid,m.roleid,1,ARRAY[r.oid,m.roleid],m.admin_option,m.inherit_option,m.set_option
 from pg_roles r join pg_auth_members m on m.member=r.oid
 where r.rolname in ('anon','authenticated','service_role')
 union all
 select inherited.root_role,inherited.role_oid,m.roleid,inherited.depth+1,
        inherited.path||m.roleid,m.admin_option,m.inherit_option,m.set_option
 from membership inherited join pg_auth_members m on m.member=inherited.role_oid
 where not m.roleid=any(inherited.path)
)
select 'role_memberships' as gate, m.root_role, member.rolname as member_role,
       granted.rolname as granted_role,m.depth,m.admin_option,m.inherit_option,m.set_option,
       pg_has_role(m.root_role,m.role_oid,'USAGE') as effective_inherited_privileges
from membership m join pg_roles member on member.oid=m.member_oid
join pg_roles granted on granted.oid=m.role_oid
order by m.root_role,m.depth,member.rolname,granted.rolname;

-- gate: tables
select 'tables' as gate, e.table_name, c.oid is not null as present,
       c.relkind='r' as ordinary_table, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced, owner_role.rolname as table_owner,
       owner_role.rolbypassrls as owner_bypass_rls,owner_role.rolsuper as owner_superuser,
       exists(select 1 from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
              where a.grantee=0) as public_has_any_acl
from (values ('kk_customer_line_sessions'),('kk_customer_terms_evidence')) e(table_name)
left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname=e.table_name
left join pg_roles owner_role on owner_role.oid=c.relowner
order by e.table_name;

-- gate: columns
select 'columns' as gate, c.relname as table_name, a.attnum as ordinal_position,
       a.attname as column_name, format_type(a.atttypid,a.atttypmod) as data_type,
       a.attnotnull as not_null, a.attidentity as identity_mode,
       case when d.oid is null then null else md5(pg_get_expr(d.adbin,d.adrelid)) end as default_definition_md5
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
where n.nspname='public' and c.relname in ('kk_customer_line_sessions','kk_customer_terms_evidence')
order by c.relname,a.attnum;

-- gate: constraints
select 'constraints' as gate, c.relname as table_name, k.contype as constraint_type,
       k.convalidated as validated, md5(pg_get_constraintdef(k.oid,true)) as definition_md5
from pg_constraint k
join pg_class c on c.oid=k.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('kk_customer_line_sessions','kk_customer_terms_evidence')
order by c.relname,k.contype,md5(pg_get_constraintdef(k.oid,true));

-- gate: indexes
select 'indexes' as gate, c.relname as table_name, i.relname as index_name,
       x.indisunique as unique_index, x.indisvalid as valid_index,
       md5(pg_get_indexdef(x.indexrelid)) as definition_md5
from pg_index x
join pg_class c on c.oid=x.indrelid
join pg_class i on i.oid=x.indexrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('kk_customer_line_sessions','kk_customer_terms_evidence')
order by c.relname,i.relname;

-- gate: table_privileges
-- service sessions=SELECT/INSERT/UPDATE/DELETE only; durable terms=SELECT/INSERT only.
-- Every anon/authenticated effective privilege below must be false.
select 'table_privileges' as gate, e.table_name, roles.role_name, privileges.privilege,
       case when c.oid is null or roles.role_oid is null then null
            else has_table_privilege(roles.role_oid,c.oid,privileges.privilege) end as effective,
       (roles.role_name='service_role'
        and (privileges.privilege in ('SELECT','INSERT')
          or (e.table_name='kk_customer_line_sessions' and privileges.privilege in ('UPDATE','DELETE')))) as expected
from (values ('kk_customer_line_sessions'),('kk_customer_terms_evidence')) e(table_name)
cross join (select v.role_name,r.oid as role_oid from
            (values ('anon'),('authenticated'),('service_role')) v(role_name)
            left join pg_roles r on r.rolname=v.role_name) roles
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) privileges(privilege)
left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname=e.table_name
order by e.table_name,roles.role_name,privileges.privilege;

-- gate: column_privileges
-- Verify direct and inherited effective column grants across exact14columns.
-- Exact REVOKE ALL removes direct service_role column grants; inherited-role grants still need review.
select 'column_privileges' as gate,c.relname as table_name,a.attname as column_name,
       roles.role_name,privileges.privilege,
       case when roles.role_oid is null then null
            else has_column_privilege(roles.role_oid,c.oid,a.attnum,privileges.privilege) end as effective,
       (roles.role_name='service_role' and
        (privileges.privilege in ('SELECT','INSERT') or
         (c.relname='kk_customer_line_sessions' and privileges.privilege='UPDATE'))) as expected
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
cross join (select v.role_name,r.oid as role_oid from
            (values ('anon'),('authenticated'),('service_role')) v(role_name)
            left join pg_roles r on r.rolname=v.role_name) roles
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) privileges(privilege)
where n.nspname='public' and c.relname in ('kk_customer_line_sessions','kk_customer_terms_evidence')
order by c.relname,a.attnum,roles.role_name,privileges.privilege;

-- gate: column_acl
select 'column_acl' as gate,c.relname as table_name,a.attname as column_name,
       case when acl.grantee=0 then 'PUBLIC' else grantee.rolname end as grantee_role,
       acl.privilege_type,acl.is_grantable
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
cross join lateral aclexplode(a.attacl) acl
left join pg_roles grantee on grantee.oid=acl.grantee
where n.nspname='public' and c.relname in ('kk_customer_line_sessions','kk_customer_terms_evidence')
order by c.relname,a.attnum,grantee_role,acl.privilege_type;

-- gate: sequence_privileges
select 'sequence_privileges' as gate, 'kk_customer_terms_evidence_id_seq' as sequence_name,
       roles.role_name, privileges.privilege,
       case when c.oid is null or roles.role_oid is null then null
            else has_sequence_privilege(roles.role_oid,c.oid,privileges.privilege) end as effective,
       (roles.role_name='service_role' and privileges.privilege in ('USAGE','SELECT')) as expected
from (select v.role_name,r.oid as role_oid from
      (values ('anon'),('authenticated'),('service_role')) v(role_name)
      left join pg_roles r on r.rolname=v.role_name) roles
cross join (values ('USAGE'),('SELECT'),('UPDATE')) privileges(privilege)
left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname='kk_customer_terms_evidence_id_seq'
order by roles.role_name,privileges.privilege;

-- gate: sequence_public_acl
select 'sequence_public_acl' as gate, c.oid is not null as present,
       exists(select 1 from aclexplode(coalesce(c.relacl,acldefault('s',c.relowner))) a
              where a.grantee=0) as public_has_any_acl
from (select 1) anchor
left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname='kk_customer_terms_evidence_id_seq';

-- gate: functions
with expected(signature) as (values
 ('public.kk_customer_session_create(text,text,text,timestamp with time zone)'),
 ('public.kk_customer_session_lookup(text)'),
 ('public.kk_customer_session_revoke(text)'),
 ('public.kk_customer_terms_lookup(text,text)'),
 ('public.kk_customer_terms_accept(text,text,text)'),
 ('public.kk_customer_terms_lookup_for_line_webhook(text,text,text)')
)
select 'functions' as gate, e.signature, p.oid is not null as present,
       not p.prosecdef as security_invoker,
       p.proconfig=ARRAY['search_path=""']::text[] as exact_empty_search_path,
       l.lanname as language_name, pg_get_function_result(p.oid) as return_shape,
       md5(p.prosrc) as body_md5,
       case when p.oid is null then null else has_function_privilege('service_role',p.oid,'EXECUTE') end as service_execute,
       case when p.oid is null then null else has_function_privilege('anon',p.oid,'EXECUTE') end as anon_execute,
       case when p.oid is null then null else has_function_privilege('authenticated',p.oid,'EXECUTE') end as authenticated_execute,
       exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
              where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute
from expected e
left join pg_proc p on p.oid=to_regprocedure(e.signature)
left join pg_language l on l.oid=p.prolang
order by e.signature;

-- gate: function_inventory
-- Extra prefix objects/overloads require review before source acceptance.
select 'function_inventory' as gate, p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as identity_arguments,
       p.prokind as function_kind
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'kk_customer_%'
order by p.proname,pg_get_function_identity_arguments(p.oid);

-- gate: policies
-- Service-only source defines no browser RLS policies. Count alone is not grant verification.
select 'policies' as gate, e.table_name, count(p.policyname)::integer as policy_count
from (values ('kk_customer_line_sessions'),('kk_customer_terms_evidence')) e(table_name)
left join pg_policies p on p.schemaname='public' and p.tablename=e.table_name
group by e.table_name order by e.table_name;

-- gate: custom_acl
-- Metadata only. Unexpected grant roles/grant options need separate DBA review.
select 'custom_acl' as gate, c.relname as object_name,
       case when a.grantee=0 then 'PUBLIC' else grantee.rolname end as grantee_role,
       a.privilege_type, a.is_grantable
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl,
  acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) a
left join pg_roles grantee on grantee.oid=a.grantee
where n.nspname='public' and c.relname in
 ('kk_customer_line_sessions','kk_customer_terms_evidence','kk_customer_terms_evidence_id_seq')
order by c.relname,grantee_role,a.privilege_type;

rollback;
