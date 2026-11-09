-- Isolated DB only. Rollback fixtures; sequences may advance.
BEGIN;
DO $$
DECLARE teacher bigint; student bigint; other_student bigint; room bigint; seat bigint;
 b bigint; session bigint; held seat_reservations; retry seat_reservations; other_hold seat_reservations;
BEGIN
 SELECT user_id INTO STRICT teacher FROM users WHERE user_code='teacher';
 SELECT user_id INTO STRICT student FROM users WHERE user_code='student';
 INSERT INTO users(user_code,full_name,email,password_hash) VALUES('hold-other','Other','hold-other@test.invalid','test') RETURNING user_id INTO other_student;
 INSERT INTO user_roles SELECT other_student,role_id FROM roles WHERE role_name='STUDENT';
 INSERT INTO rooms(room_code,name,status) VALUES('A-HOLD-TEST','Hold test','ACTIVE') RETURNING room_id INTO room;
 INSERT INTO seats(room_id,seat_number,status) VALUES(room,1,'AVAILABLE') RETURNING seat_id INTO seat;
 INSERT INTO bookings(user_id,room_id,start_time,end_time,status)
 VALUES(teacher,room,now()+interval '1 day',now()+interval '25 hours','PENDING') RETURNING booking_id INTO b;
 INSERT INTO class_sessions(booking_id,course_code,title,room_id,start_time,end_time)
 SELECT booking_id,'HOLD','Hold test',room_id,start_time,end_time FROM bookings WHERE booking_id=b RETURNING class_session_id INTO session;
 BEGIN
   PERFORM hold_class_seat(session,seat,student);
   RAISE EXCEPTION 'TEST: allowed unapproved class';
 EXCEPTION WHEN check_violation THEN NULL; END;
 UPDATE bookings SET status='CONFIRMED' WHERE booking_id=b;
 held:=hold_class_seat(session,seat,student);
 IF held.status<>'PENDING' OR held.hold_expires_at NOT BETWEEN clock_timestamp()+interval '115 seconds' AND clock_timestamp()+interval '121 seconds' THEN
   RAISE EXCEPTION 'TEST: wrong hold state or deadline'; END IF;
 retry:=hold_class_seat(session,seat,student);
 IF retry.seat_reservation_id<>held.seat_reservation_id OR retry.hold_expires_at<>held.hold_expires_at THEN
   RAISE EXCEPTION 'TEST: retry extended hold'; END IF;
 BEGIN
   PERFORM hold_class_seat(session,seat,other_student);
   RAISE EXCEPTION 'TEST: allowed another student to take held seat';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
   PERFORM confirm_class_seat(held.seat_reservation_id,other_student);
   RAISE EXCEPTION 'TEST: allowed confirmation by another student';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 retry:=confirm_class_seat(held.seat_reservation_id,student);
 IF retry.status<>'CONFIRMED' THEN RAISE EXCEPTION 'TEST: confirmation failed'; END IF;
 IF (SELECT reservation_status FROM class_seat_availability WHERE class_session_id=session AND seat_id=seat)<>'RESERVED' THEN
   RAISE EXCEPTION 'TEST: confirmed seat not shown as reserved'; END IF;
 BEGIN
   PERFORM hold_class_seat(session,seat,other_student);
   RAISE EXCEPTION 'TEST: allowed another student to take confirmed seat';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 PERFORM cancel_class_seat(held.seat_reservation_id,student);
 held:=hold_class_seat(session,seat,student);
 UPDATE seat_reservations SET hold_expires_at=clock_timestamp()-interval '1 second' WHERE seat_reservation_id=held.seat_reservation_id;
 BEGIN
   PERFORM confirm_class_seat(held.seat_reservation_id,student);
   RAISE EXCEPTION 'TEST: confirmed expired hold';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT reservation_status FROM class_seat_availability WHERE class_session_id=session AND seat_id=seat)<>'AVAILABLE' THEN
   RAISE EXCEPTION 'TEST: expired hold not shown available'; END IF;
 other_hold:=hold_class_seat(session,seat,other_student);
 IF (SELECT status FROM seat_reservations WHERE seat_reservation_id=held.seat_reservation_id)<>'CANCELLED' THEN
   RAISE EXCEPTION 'TEST: expired hold history not cancelled'; END IF;
 BEGIN
   INSERT INTO seat_reservations(class_session_id,seat_id,user_id,room_id,status)
   VALUES(session,seat,student,room,'CONFIRMED');
   RAISE EXCEPTION 'TEST: direct insert bypassed hold uniqueness';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 IF (SELECT status FROM seats WHERE seat_id=seat)<>'AVAILABLE' THEN
   RAISE EXCEPTION 'TEST: physical seat status changed'; END IF;
 RAISE NOTICE 'PASS: approval, 2-minute hold, ownership, retry, pending/confirmed exclusion, expiry, reclaim, view and physical seat independence';
END $$;
ROLLBACK;
