-- psql -v ON_ERROR_STOP=1 -f database/tests/verify_reservation_constraints.sql
-- Use a disposable database with 001-006 applied. All fixture changes roll back.
BEGIN;

CREATE FUNCTION pg_temp.expect_rejected(statement TEXT, expected_state TEXT, expected_constraint TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual_constraint TEXT;
BEGIN
    BEGIN
        EXECUTE statement;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS actual_constraint = CONSTRAINT_NAME;
        IF SQLSTATE <> expected_state OR actual_constraint <> expected_constraint THEN
            RAISE EXCEPTION 'Wrong rejection: expected % / %, received % / %: %',
                expected_state, expected_constraint, SQLSTATE, actual_constraint, SQLERRM;
        END IF;
        RETURN;
    END;
    RAISE EXCEPTION 'Expected rejection % / %, but statement succeeded: %',
        expected_state, expected_constraint, statement;
END $$;

DO $$
DECLARE
    first_user BIGINT;
    second_user BIGINT;
    third_user BIGINT;
    first_room BIGINT;
    second_room BIGINT;
    first_booking BIGINT;
    cancelled_booking BIGINT;
    first_session BIGINT;
    first_seat BIGINT;
    second_seat BIGINT;
    other_room_seat BIGINT;
    first_selection BIGINT;
    cancelled_selection BIGINT;
    booking_template TEXT;
    selection_template TEXT;
BEGIN
    INSERT INTO users(user_code,full_name,email,password_hash)
        VALUES ('__dbtest_user_1','DB test 1','__dbtest_1@example.test','not-a-login-hash') RETURNING user_id INTO first_user;
    INSERT INTO users(user_code,full_name,email,password_hash)
        VALUES ('__dbtest_user_2','DB test 2','__dbtest_2@example.test','not-a-login-hash') RETURNING user_id INTO second_user;
    INSERT INTO users(user_code,full_name,email,password_hash)
        VALUES ('__dbtest_user_3','DB test 3','__dbtest_3@example.test','not-a-login-hash') RETURNING user_id INTO third_user;
    INSERT INTO rooms(room_code,name,status) VALUES ('A__dbtest_room_1','DB test room 1','ACTIVE') RETURNING room_id INTO first_room;
    INSERT INTO rooms(room_code,name,status) VALUES ('A__dbtest_room_2','DB test room 2','ACTIVE') RETURNING room_id INTO second_room;

    booking_template := 'INSERT INTO bookings(user_id,room_id,start_time,end_time,status) VALUES (%s,%s,%L,%L,%L)';
    PERFORM pg_temp.expect_rejected(format(booking_template,-999,first_room,'2098-01-01 08:00+07','2098-01-01 10:00+07','PENDING'), '23503','fk_booking_user');
    PERFORM pg_temp.expect_rejected(format(booking_template,first_user,-999,'2098-01-01 08:00+07','2098-01-01 10:00+07','PENDING'), '23503','fk_booking_room');
    PERFORM pg_temp.expect_rejected(format(booking_template,first_user,first_room,'2098-01-01 08:00+07','2098-01-01 08:00+07','PENDING'), '23514','chk_bookings_time_range');
    PERFORM pg_temp.expect_rejected(format(booking_template,first_user,first_room,'2098-01-01 10:00+07','2098-01-01 08:00+07','PENDING'), '23514','chk_bookings_time_range');
    PERFORM pg_temp.expect_rejected(format(booking_template,first_user,first_room,'2098-01-01 08:00+07','2098-01-01 10:00+07','APPROVED'), '23514','chk_bookings_status');
    PERFORM pg_temp.expect_rejected(format(booking_template,first_user,first_room,'2098-01-01 08:00+07','2098-01-01 10:00+07','unknown'), '23514','chk_bookings_status');

    INSERT INTO bookings(user_id,room_id,start_time,end_time)
        VALUES(first_user,first_room,'2098-01-01 08:00+07','2098-01-01 10:00+07') RETURNING booking_id INTO first_booking;
    IF (SELECT status FROM bookings WHERE booking_id=first_booking) <> 'PENDING' THEN RAISE EXCEPTION 'Wrong default reservation status'; END IF;
    PERFORM pg_temp.expect_rejected(format(booking_template,second_user,first_room,'2098-01-01 09:00+07','2098-01-01 11:00+07','PENDING'), '23P01','ex_bookings_room_active_time');
    PERFORM pg_temp.expect_rejected(format(booking_template,second_user,first_room,'2098-01-01 07:00+07','2098-01-01 11:00+07','CONFIRMED'), '23P01','ex_bookings_room_active_time');
    -- Equivalent instants expressed in UTC must conflict too.
    PERFORM pg_temp.expect_rejected(format(booking_template,second_user,first_room,'2098-01-01 01:00+00','2098-01-01 03:00+00','CONFIRMED'), '23P01','ex_bookings_room_active_time');
    EXECUTE format(booking_template,second_user,first_room,'2098-01-01 10:00+07','2098-01-01 11:00+07','CONFIRMED');
    EXECUTE format(booking_template,second_user,second_room,'2098-01-01 08:00+07','2098-01-01 10:00+07','CONFIRMED');
    EXECUTE format(booking_template,second_user,first_room,'2098-01-01 08:00+07','2098-01-01 10:00+07','REJECTED');
    INSERT INTO bookings(user_id,room_id,start_time,end_time,status)
        VALUES(second_user,first_room,'2098-01-01 08:00+07','2098-01-01 10:00+07','CANCELLED') RETURNING booking_id INTO cancelled_booking;
    PERFORM pg_temp.expect_rejected(format('UPDATE bookings SET status=''CONFIRMED'' WHERE booking_id=%s',cancelled_booking), '23P01','ex_bookings_room_active_time');

    INSERT INTO class_sessions(booking_id,course_code,title,room_id,start_time,end_time)
        VALUES(first_booking,'DB101','Database test',first_room,'2098-01-01 08:00+07','2098-01-01 10:00+07') RETURNING class_session_id INTO first_session;
    PERFORM pg_temp.expect_rejected(format('INSERT INTO class_sessions(booking_id,course_code,title,room_id,start_time,end_time) VALUES(%s,''DB101'',''Duplicate'',%s,''2098-01-01 08:00+07'',''2098-01-01 10:00+07'')',first_booking,first_room), '23505','uq_class_sessions_booking');
    PERFORM pg_temp.expect_rejected(format('UPDATE class_sessions SET room_id=%s WHERE class_session_id=%s',second_room,first_session), '23503','fk_class_sessions_booking_room_time');
    PERFORM pg_temp.expect_rejected(format('UPDATE class_sessions SET end_time=''2098-01-01 09:00+07'' WHERE class_session_id=%s',first_session), '23503','fk_class_sessions_booking_room_time');
    PERFORM pg_temp.expect_rejected(format('UPDATE class_sessions SET title='' '' WHERE class_session_id=%s',first_session), '23514','chk_class_sessions_title');
    PERFORM pg_temp.expect_rejected(format('UPDATE class_sessions SET course_code='' '' WHERE class_session_id=%s',first_session), '23514','chk_class_sessions_course_code');
    PERFORM pg_temp.expect_rejected(format('UPDATE class_sessions SET end_time=start_time WHERE class_session_id=%s',first_session), '23514','chk_class_sessions_time_range');
    PERFORM pg_temp.expect_rejected(format('UPDATE bookings SET end_time=''2098-01-01 09:00+07'' WHERE booking_id=%s',first_booking), '23503','fk_class_sessions_booking_room_time');

    INSERT INTO seats(room_id,seat_number,status) VALUES(first_room,1,'AVAILABLE') RETURNING seat_id INTO first_seat;
    INSERT INTO seats(room_id,seat_number,status) VALUES(first_room,2,'AVAILABLE') RETURNING seat_id INTO second_seat;
    INSERT INTO seats(room_id,seat_number,status) VALUES(second_room,1,'AVAILABLE') RETURNING seat_id INTO other_room_seat;
    PERFORM pg_temp.expect_rejected(format('INSERT INTO seats(room_id,seat_number,status) VALUES(%s,1,''AVAILABLE'')',first_room), '23505','uq_seats_room_number');
    PERFORM pg_temp.expect_rejected(format('INSERT INTO seats(room_id,seat_number,status) VALUES(%s,0,''AVAILABLE'')',first_room), '23514','chk_seats_number_positive');

    UPDATE bookings SET status='CONFIRMED' WHERE booking_id=first_booking;
    selection_template := 'INSERT INTO seat_reservations(class_session_id,seat_id,user_id,room_id,status) VALUES(%s,%s,%s,%s,%L)';
    PERFORM pg_temp.expect_rejected(format(selection_template,first_session,first_seat,-999,first_room,'CONFIRMED'), '23503','fk_seat_reservations_user');
    PERFORM pg_temp.expect_rejected(format(selection_template,-999,first_seat,first_user,first_room,'CONFIRMED'), '23503','fk_seat_reservations_session_room');
    PERFORM pg_temp.expect_rejected(format(selection_template,first_session,-999,first_user,first_room,'CONFIRMED'), '23503','fk_seat_reservations_seat_room');
    PERFORM pg_temp.expect_rejected(format(selection_template,first_session,other_room_seat,first_user,first_room,'CONFIRMED'), '23503','fk_seat_reservations_seat_room');
    PERFORM pg_temp.expect_rejected(format(selection_template,first_session,other_room_seat,first_user,second_room,'CONFIRMED'), '23503','fk_seat_reservations_session_room');
    PERFORM pg_temp.expect_rejected(format(selection_template,first_session,first_seat,first_user,first_room,'INVALID'), '23514','chk_seat_reservations_status');

    INSERT INTO seat_reservations(class_session_id,seat_id,user_id,room_id)
        VALUES(first_session,first_seat,first_user,first_room) RETURNING seat_reservation_id INTO first_selection;
    PERFORM pg_temp.expect_rejected(format(selection_template,first_session,first_seat,second_user,first_room,'CONFIRMED'), '23505','uq_seat_reservations_active_seat');
    PERFORM pg_temp.expect_rejected(format(selection_template,first_session,second_seat,first_user,first_room,'CONFIRMED'), '23505','uq_seat_reservations_active_user');
    INSERT INTO seat_reservations(class_session_id,seat_id,user_id,room_id,status)
        VALUES(first_session,first_seat,second_user,first_room,'CANCELLED') RETURNING seat_reservation_id INTO cancelled_selection;
    PERFORM pg_temp.expect_rejected(format('UPDATE seat_reservations SET status=''CONFIRMED'' WHERE seat_reservation_id=%s',cancelled_selection), '23505','uq_seat_reservations_active_seat');
    UPDATE seat_reservations SET status='CANCELLED' WHERE seat_reservation_id=first_selection;
    UPDATE seat_reservations SET status='CONFIRMED' WHERE seat_reservation_id=cancelled_selection;
    EXECUTE format(selection_template,first_session,second_seat,first_user,first_room,'CONFIRMED');
    PERFORM pg_temp.expect_rejected(format('UPDATE seat_reservations SET seat_id=%s WHERE seat_reservation_id=%s',second_seat,cancelled_selection), '23505','uq_seat_reservations_active_seat');
    -- Cancelling and then rebooking must preserve all cancelled history rows.
    IF (SELECT count(*) FROM seat_reservations WHERE class_session_id=first_session) <> 3 THEN RAISE EXCEPTION 'Seat history was not preserved'; END IF;

    -- The same seat and user can be used in a later non-overlapping session.
    INSERT INTO bookings(user_id,room_id,start_time,end_time,status)
        VALUES(first_user,first_room,'2098-01-01 11:00+07','2098-01-01 12:00+07','CONFIRMED') RETURNING booking_id INTO first_booking;
    INSERT INTO class_sessions(booking_id,course_code,title,room_id,start_time,end_time)
        VALUES(first_booking,'DB102','Later session',first_room,'2098-01-01 11:00+07','2098-01-01 12:00+07') RETURNING class_session_id INTO first_session;
    EXECUTE format(selection_template,first_session,first_seat,first_user,first_room,'CONFIRMED');

    RAISE NOTICE 'PASS: reservation status/FK/time/overlap, session consistency, seat uniqueness, room consistency, cancellation and rebooking.';
END $$;

-- Fixed room resources: one equipment group may have many incident reports.
DO $$
DECLARE first_room bigint; other_room bigint; actor bigint; equipment bigint; report bigint;
BEGIN
 SELECT room_id INTO STRICT first_room FROM rooms WHERE room_code='A101';
 SELECT room_id INTO STRICT other_room FROM rooms WHERE room_code='B201';
 SELECT user_id INTO STRICT actor FROM users WHERE user_code='student';
 SELECT resource_id INTO STRICT equipment FROM resources
 WHERE room_id=first_room AND resource_type='COMPUTER' AND resource_name='May tinh';
 IF (SELECT quantity FROM resources WHERE resource_id=equipment)<>30 THEN
   RAISE EXCEPTION 'TEST: expected seeded group of 30 computers'; END IF;
 INSERT INTO incidents(room_id,resource_id,reported_by,description)
 VALUES(first_room,equipment,actor,'Computer 12 does not start') RETURNING incident_id INTO report;
 INSERT INTO incidents(room_id,resource_id,reported_by,description)
 VALUES(first_room,equipment,actor,'Computer 15 keyboard broken');
 INSERT INTO incidents(room_id,resource_id,reported_by,description)
 VALUES(first_room,NULL,actor,'Room power outage');
 IF (SELECT count(*) FROM incidents WHERE resource_id=equipment)<>2 THEN
   RAISE EXCEPTION 'TEST: equipment must allow multiple incidents'; END IF;
 IF NOT EXISTS(SELECT 1 FROM resources WHERE resource_id=equipment AND quantity=30 AND status='AVAILABLE') THEN
   RAISE EXCEPTION 'TEST: individual incident changed installed inventory or group status'; END IF;
 PERFORM pg_temp.expect_rejected(format(
   'INSERT INTO incidents(room_id,resource_id,reported_by) VALUES(%s,%s,%s)',other_room,equipment,actor),
   '23503','fk_incident_resource_room');
 PERFORM pg_temp.expect_rejected(format(
   'UPDATE incidents SET room_id=%s WHERE incident_id=%s',other_room,report),
   '23503','fk_incident_resource_room');
 PERFORM pg_temp.expect_rejected(format(
   'UPDATE resources SET room_id=%s WHERE resource_id=%s',other_room,equipment),
   '23503','fk_incident_resource_room');
 PERFORM pg_temp.expect_rejected(format(
   'UPDATE resources SET quantity=-1 WHERE resource_id=%s',equipment),
   '23514','chk_resources_quantity');
 RAISE NOTICE 'PASS: fixed-room seed, 1:N incidents, optional resource, cross-room INSERT/UPDATE blocked, installed quantity/group status preserved';
END $$;

ROLLBACK;
