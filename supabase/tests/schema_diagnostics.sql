-- Row-level diagnostics used only when a component fingerprint differs.
select detail
from (
select jsonb_build_object(
  'kind', 'column',
  'table', c.relname,
  'position', a.attnum,
  'name', a.attname,
  'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
  'not_null', a.attnotnull,
  'identity', a.attidentity,
  'generated', a.attgenerated,
  'default', pg_catalog.pg_get_expr(d.adbin, d.adrelid)
) as detail
from pg_catalog.pg_attribute a
join pg_catalog.pg_class c on c.oid = a.attrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
left join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm')
  and a.attnum > 0
  and not a.attisdropped

union all

select jsonb_build_object(
  'kind', 'function_grant',
  'role', r.role_name,
  'function', p.proname,
  'arguments', pg_catalog.pg_get_function_identity_arguments(p.oid)
)
from (values ('anon'), ('authenticated'), ('service_role')) r(role_name)
join pg_catalog.pg_proc p on pg_catalog.has_function_privilege(r.role_name, p.oid, 'EXECUTE')
join pg_catalog.pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
) details
order by detail::text;
