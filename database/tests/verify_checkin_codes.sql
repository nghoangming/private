-- Run only on an isolated test database after 001, 002, 006, 008, 012.
BEGIN;
DO $$
DECLARE
    teacher BIGINT; student BIGINT; other_student BIGINT; room BIGINT; seat BIGINT;
    booking BIGINT; session BIGINT; first_code checkin_challenges; next_code checkin_challenges;
    result_id BIGINT; other_booking BIGINT; other_session BIGINT; other_challenge BIGINT;
BEGIN
    INSERT INTO users(user_code, full_name, email, password_hash) VALUES
        ('test-teacher', 'Teacher', 'checkin-teacher@test.invalid', 'test') RETURNING user_id INTO teacher;
    INSERT INTO users(user_code, full_name, email, password_hash) VALUES
        ('test-student', 'Student', 'checkin-student@test.invalid', 'test') RETURNING user_id INTO student;
    INSERT INTO users(user_code, full_name, email, password_hash) VALUES
        ('test-other', 'Other', 'checkin-other@test.invalid', 'test') RETURNING user_id INTO other_student;
    INSERT INTO user_roles SELECT teacher, role_id FROM roles WHERE role_name = 'TEACHER';
    INSERT INTO user_roles SELECT student, role_id FROM roles WHERE role_name = 'STUDENT';
    INSERT INTO user_roles SELECT other_student, role_id FROM roles WHERE role_name = 'STUDENT';
    INSERT INTO rooms(room_code, name, status) VALUES ('C-CHECKIN-TEST', 'Test', 'ACTIVE') RETURNING room_id INTO room;
    INSERT INTO seats(room_id, seat_number, status) VALUES (room, 1, 'AVAILABLE') RETURNING seat_id INTO seat;
    INSERT INTO bookings(user_id, room_id, start_time, end_time, status)
        VALUES(teacher, room, now() - interval '5 minutes', now() + interval '1 hour', 'CONFIRMED')
        RETURNING booking_id INTO booking;
    INSERT INTO class_sessions(booking_id, course_code, title, room_id, start_time, end_time)
        SELECT booking_id, 'TEST', 'Test', room_id, start_time, end_time FROM bookings WHERE booking_id = booking
        RETURNING class_session_id INTO session;
    INSERT INTO seat_reservations(class_session_id, seat_id, user_id, room_id,status) VALUES(session, seat, student, room,'CONFIRMED');
    BEGIN
        PERFORM issue_checkin_challenge(session, student);
        RAISE EXCEPTION 'TEST: student issued a code';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    first_code := issue_checkin_challenge(session, teacher);
    next_code := issue_checkin_challenge(session, teacher);
    INSERT INTO bookings(user_id,room_id,start_time,end_time,status)
        VALUES(teacher,room,now()+interval '1 day',now()+interval '25 hours','CONFIRMED')
        RETURNING booking_id INTO other_booking;
    INSERT INTO class_sessions(booking_id,course_code,title,room_id,start_time,end_time)
        SELECT booking_id,'OTHER','Other class',room_id,start_time,end_time FROM bookings WHERE booking_id=other_booking
        RETURNING class_session_id INTO other_session;
    INSERT INTO checkin_challenges(class_session_id,manual_code,issued_by,expires_at)
        VALUES(other_session,'AB123',teacher,now()+interval '1 hour') RETURNING challenge_id INTO other_challenge;
    BEGIN
        INSERT INTO checkins(booking_id,user_id,method,status,challenge_id)
            VALUES(booking,student,'QR','FAILED',other_challenge);
        RAISE EXCEPTION 'TEST: accepted challenge from another class';
    EXCEPTION WHEN foreign_key_violation THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_checkin_challenge_booking') THEN RAISE; END IF;
    END;
    BEGIN
        PERFORM submit_class_checkin(session,student,'MANUAL_CODE','AB123');
        RAISE EXCEPTION 'TEST: accepted another class manual code';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'Invalid or expired check-in code' THEN RAISE; END IF;
    END;
    IF first_code.manual_code = next_code.manual_code OR first_code.qr_token = next_code.qr_token THEN
        RAISE EXCEPTION 'TEST: rotation reused a code';
    END IF;
    BEGIN
        PERFORM submit_class_checkin(session, student, 'QR', first_code.qr_token::text);
        RAISE EXCEPTION 'TEST: accepted revoked QR';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'Invalid or expired check-in code' THEN RAISE; END IF;
    END;
    BEGIN
        PERFORM submit_class_checkin(session, student, 'MANUAL_CODE', first_code.manual_code);
        RAISE EXCEPTION 'TEST: accepted revoked manual code';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'Invalid or expired check-in code' THEN RAISE; END IF;
    END;
    BEGIN
        PERFORM submit_class_checkin(session, other_student, 'MANUAL_CODE', next_code.manual_code);
        RAISE EXCEPTION 'TEST: accepted student without reservation';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'A confirmed seat reservation is required' THEN RAISE; END IF;
    END;
    result_id := submit_class_checkin(session, student, 'MANUAL_CODE', lower(next_code.manual_code));
    IF NOT EXISTS (SELECT 1 FROM attendance a JOIN checkins c USING(checkin_id)
        WHERE c.checkin_id = result_id AND a.attendance_status = 'PRESENT'
        AND a.check_in_at = c.checked_in_at AND c.challenge_id = next_code.challenge_id) THEN
        RAISE EXCEPTION 'TEST: attendance not written consistently';
    END IF;
    BEGIN
        PERFORM submit_class_checkin(session, student, 'QR', next_code.qr_token::text);
        RAISE EXCEPTION 'TEST: accepted duplicate via QR';
    EXCEPTION WHEN unique_violation THEN NULL; END;
    DELETE FROM attendance WHERE checkin_id = result_id;
    DELETE FROM checkins WHERE checkin_id = result_id;
    PERFORM submit_class_checkin(session, student, 'QR', next_code.qr_token::text);
    BEGIN
        INSERT INTO checkins(booking_id, user_id, method, status) VALUES(booking, student, 'OTHER', 'FAILED');
        RAISE EXCEPTION 'TEST: accepted invalid method';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
        INSERT INTO checkins(booking_id, user_id, method, status) VALUES(booking, student, 'QR', 'OTHER');
        RAISE EXCEPTION 'TEST: accepted invalid status';
    EXCEPTION WHEN check_violation THEN NULL; END;
    INSERT INTO checkins(booking_id, user_id, method, status) VALUES(booking, student, 'QR', 'FAILED');
    UPDATE checkin_challenges SET issued_at = now() - interval '10 minutes',
        expires_at = now() - interval '1 minute' WHERE challenge_id = next_code.challenge_id;
    BEGIN
        PERFORM submit_class_checkin(session, student, 'MANUAL_CODE', next_code.manual_code);
        RAISE EXCEPTION 'TEST: accepted expired manual code';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'Invalid or expired check-in code' THEN RAISE; END IF;
    END;
    UPDATE bookings SET status = 'CANCELLED' WHERE booking_id = booking;
    BEGIN
        PERFORM issue_checkin_challenge(session, teacher);
        RAISE EXCEPTION 'TEST: issued code for cancelled booking';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'Check-in is only open during a confirmed class session' THEN RAISE; END IF;
    END;
    RAISE NOTICE 'PASS: role, reservation, rotation, QR, manual code, duplicate success, method/status, atomic attendance';
END $$;
ROLLBACK;


