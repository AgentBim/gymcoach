-- Deterministic fingerprint of the application-owned public schema.
-- Run with: psql -Atf supabase/tests/schema_fingerprint.sql
with
relations as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', c.relname,
    'kind', c.relkind,
    'rls', c.relrowsecurity,
    'force_rls', c.relforcerowsecurity
  ) order by c.relname), '[]'::jsonb) as value
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
),
columns as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'table', c.relname,
    'position', a.attnum,
    'name', a.attname,
    'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
    'not_null', a.attnotnull,
    'identity', a.attidentity,
    'generated', a.attgenerated,
    'default', replace(pg_catalog.pg_get_expr(d.adbin, d.adrelid), 'extensions.', '')
  ) order by c.relname, a.attnum), '[]'::jsonb) as value
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  left join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm')
    and a.attnum > 0
    and not a.attisdropped
),
constraints as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'table', c.relname,
    'name', con.conname,
    'type', con.contype,
    'validated', con.convalidated,
    'definition', pg_catalog.pg_get_constraintdef(con.oid, true)
  ) order by c.relname, con.conname), '[]'::jsonb) as value
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class c on c.oid = con.conrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
),
indexes as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'table', t.relname,
    'name', i.relname,
    'definition', pg_catalog.pg_get_indexdef(i.oid)
  ) order by t.relname, i.relname), '[]'::jsonb) as value
  from pg_catalog.pg_index x
  join pg_catalog.pg_class i on i.oid = x.indexrelid
  join pg_catalog.pg_class t on t.oid = x.indrelid
  join pg_catalog.pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
),
policies as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'table', p.tablename,
    'name', p.policyname,
    'permissive', p.permissive,
    'roles', p.roles,
    'command', p.cmd,
    'using', p.qual,
    'check', p.with_check
  ) order by p.tablename, p.policyname), '[]'::jsonb) as value
  from pg_catalog.pg_policies p
  where p.schemaname = 'public'
),
functions as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', p.proname,
    'arguments', pg_catalog.pg_get_function_identity_arguments(p.oid),
    'result', pg_catalog.pg_get_function_result(p.oid),
    'language', l.lanname,
    'security_definer', p.prosecdef,
    'volatility', p.provolatile,
    'config', p.proconfig,
    'definition', pg_catalog.pg_get_functiondef(p.oid)
  ) order by p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid)), '[]'::jsonb) as value
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join pg_catalog.pg_language l on l.oid = p.prolang
  where n.nspname = 'public'
),
enums as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'type', t.typname,
    'position', e.enumsortorder,
    'label', e.enumlabel
  ) order by t.typname, e.enumsortorder), '[]'::jsonb) as value
  from pg_catalog.pg_type t
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  join pg_catalog.pg_enum e on e.enumtypid = t.oid
  where n.nspname = 'public'
),
triggers as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'table', c.relname,
    'name', t.tgname,
    'definition', pg_catalog.pg_get_triggerdef(t.oid, true)
  ) order by c.relname, t.tgname), '[]'::jsonb) as value
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
),
table_grants as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'role', r.role_name,
    'table', c.relname,
    'privilege', p.privilege
  ) order by r.role_name, c.relname, p.privilege), '[]'::jsonb) as value
  from (values ('anon'), ('authenticated'), ('service_role')) r(role_name)
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(privilege)
  join pg_catalog.pg_class c on c.relkind in ('r', 'p', 'v', 'm')
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where pg_catalog.has_table_privilege(r.role_name, c.oid, p.privilege)
),
function_grants as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'role', r.role_name,
    'function', p.proname,
    'arguments', pg_catalog.pg_get_function_identity_arguments(p.oid)
  ) order by r.role_name, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid)), '[]'::jsonb) as value
  from (values ('anon'), ('authenticated'), ('service_role')) r(role_name)
  join pg_catalog.pg_proc p on pg_catalog.has_function_privilege(r.role_name, p.oid, 'EXECUTE')
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
),
default_privileges as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'role', owner_role.rolname,
    'namespace', n.nspname,
    'object_type', d.defaclobjtype,
    'acl', d.defaclacl::text
  ) order by owner_role.rolname, n.nspname, d.defaclobjtype), '[]'::jsonb) as value
  from pg_catalog.pg_default_acl d
  join pg_catalog.pg_roles owner_role on owner_role.oid = d.defaclrole
  left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public'
)
select component, fingerprint
from (
  select 'columns' as component, md5(columns.value::text) as fingerprint from columns
  union all select 'constraints', md5(constraints.value::text) from constraints
  union all select 'default_privileges', md5(default_privileges.value::text) from default_privileges
  union all select 'enums', md5(enums.value::text) from enums
  union all select 'function_grants', md5(function_grants.value::text) from function_grants
  union all select 'functions', md5(functions.value::text) from functions
  union all select 'indexes', md5(indexes.value::text) from indexes
  union all select 'policies', md5(policies.value::text) from policies
  union all select 'relations', md5(relations.value::text) from relations
  union all select 'table_grants', md5(table_grants.value::text) from table_grants
  union all select 'triggers', md5(triggers.value::text) from triggers
  union all
  select 'schema', md5(jsonb_build_object(
    'relations', relations.value,
    'columns', columns.value,
    'constraints', constraints.value,
    'indexes', indexes.value,
    'policies', policies.value,
    'functions', functions.value,
    'enums', enums.value,
    'triggers', triggers.value,
    'table_grants', table_grants.value,
    'function_grants', function_grants.value,
    'default_privileges', default_privileges.value
  )::text)
  from relations, columns, constraints, indexes, policies, functions, enums,
    triggers, table_grants, function_grants, default_privileges
) fingerprints
order by component;
