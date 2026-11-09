-- Read-only; fail immediately on unvalidated constraints or orphaned foreign keys.
BEGIN TRANSACTION READ ONLY;
DO $$
DECLARE c record; predicate text; bad boolean;
BEGIN
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated) THEN
   RAISE EXCEPTION 'Unvalidated constraint';
 END IF;
 FOR c IN SELECT * FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace LOOP
   SELECT string_agg(format('p.%I = ch.%I',pa.attname,ca.attname),' AND ' ORDER BY k.n)
   INTO predicate FROM unnest(c.conkey,c.confkey) WITH ORDINALITY k(child,parent,n)
   JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=k.child
   JOIN pg_attribute pa ON pa.attrelid=c.confrelid AND pa.attnum=k.parent;
   -- MATCH SIMPLE: any NULL makes the FK optional.
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s ch WHERE %s AND NOT EXISTS(SELECT 1 FROM %s p WHERE %s))',
     c.conrelid::regclass,
     (SELECT string_agg(format('ch.%I IS NOT NULL',a.attname),' AND ') FROM unnest(c.conkey) k JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k),
     c.confrelid::regclass,predicate) INTO bad;
   IF bad THEN RAISE EXCEPTION 'Orphan FK: %',c.conname; END IF;
 END LOOP;
 IF EXISTS (SELECT 1 FROM booking_seats bs JOIN bookings b USING(booking_id) JOIN seats s USING(seat_id) WHERE b.room_id<>s.room_id) THEN
   RAISE EXCEPTION 'Legacy booking_seats has a seat in another room';
 END IF;
 IF EXISTS (SELECT 1 FROM incidents i JOIN resources r USING(resource_id) WHERE i.room_id<>r.room_id) THEN
   RAISE EXCEPTION 'Incident resource belongs to another room';
 END IF;
 IF EXISTS (SELECT 1 FROM checkins ci JOIN checkin_challenges ch USING(challenge_id) JOIN class_sessions cs USING(class_session_id) WHERE ci.booking_id<>cs.booking_id) THEN
   RAISE EXCEPTION 'Check-in challenge belongs to another booking';
 END IF;
 RAISE NOTICE 'PASS: all public FKs, validation flags and reviewed cross-table relationships';
END $$;
SELECT conrelid::regclass AS relation, conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2;
SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1,2;
SELECT tablename,policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY 1,2;
ROLLBACK;

