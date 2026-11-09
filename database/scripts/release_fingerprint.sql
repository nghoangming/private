-- psql script. Stable fingerprints include every public row and sequence state.
SELECT format('SELECT %L AS relation, count(*) AS rows, md5(coalesce(string_agg(row_data, chr(10) ORDER BY row_data), %L)) AS digest FROM (SELECT to_jsonb(t)::text AS row_data FROM %I.%I t) x;',
 tablename,'',schemaname,tablename)
FROM pg_tables WHERE schemaname='public' ORDER BY tablename
\gexec
SELECT format('SELECT %L AS sequence, last_value,is_called FROM %I.%I;',sequencename,schemaname,sequencename)
FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename
\gexec
