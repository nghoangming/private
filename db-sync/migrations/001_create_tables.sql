CREATE TABLE users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_code VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE rooms ( 
    room_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_code VARCHAR(20) NOT NULL UNIQUE, 
    name VARCHAR(100) NOT NULL, 
    location VARCHAR(100), 
    status VARCHAR(20) NOT NULL 
);
CREATE TABLE seats ( 
    seat_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, 
    room_id BIGINT NOT NULL,
    seat_number INT NOT NULL, 
    status VARCHAR(20) NOT NULL, 
    CONSTRAINT fk_seat_room FOREIGN KEY (room_id) REFERENCES rooms(room_id) 
);
CREATE TABLE bookings ( 
    booking_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, 
    user_id BIGINT NOT NULL, 
    room_id BIGINT NOT NULL, 
    start_time TIMESTAMPTZ NOT NULL, 
    end_time TIMESTAMPTZ NOT NULL, 
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT fk_booking_room FOREIGN KEY (room_id) REFERENCES rooms(room_id) 
);
CREATE TABLE booking_seats ( 
    booking_id BIGINT NOT NULL, 
    seat_id BIGINT NOT NULL, 
    PRIMARY KEY (booking_id, seat_id), 
    CONSTRAINT fk_booking_seats_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id), 
    CONSTRAINT fk_booking_seats_seat FOREIGN KEY (seat_id) REFERENCES seats(seat_id) 
);
CREATE TABLE checkins ( 
    checkin_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, 
    booking_id BIGINT NOT NULL, 
    user_id BIGINT NOT NULL, 
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    method VARCHAR(20) NOT NULL, status VARCHAR(20) NOT NULL, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    CONSTRAINT fk_checkin_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id), 
    CONSTRAINT fk_checkin_user FOREIGN KEY (user_id) REFERENCES users(user_id) 
);
CREATE TABLE notifications ( 
    notification_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, 
    user_id BIGINT NOT NULL, 
    title VARCHAR(100) NOT NULL, 
    message TEXT NOT NULL, 
    is_read BOOLEAN NOT NULL DEFAULT FALSE, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, 
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(user_id) 
);
CREATE TABLE resources (
    resource_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	room_id BIGINT NOT NULL,
	resource_name VARCHAR(20) NOT NULL,
	resource_type VARCHAR(20) NOT NULL,
	quantity int,
	status VARCHAR (10),
	CONSTRAINT fk_resource_room FOREIGN KEY (room_id) REFERENCES rooms(room_id)
);
CREATE TABLE incidents (
    incident_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	room_id BIGINT NOT NULL,
	resource_id BIGINT NOT NULL,
	reported_by BIGINT NOT NULL,
	incident_type VARCHAR (30),
	description TEXT,
	occurred_at TIMESTAMPTZ,
	resolved_at TIMESTAMPTZ,
	CONSTRAINT fk_incident_room FOREIGN KEY (room_id) REFERENCES rooms(room_id),
    CONSTRAINT fk_incident_resource FOREIGN KEY (resource_id) REFERENCES resources(resource_id),
	CONSTRAINT fk_incident_reported FOREIGN KEY (reported_by) REFERENCES users(user_id)
);
CREATE TABLE attendance (
    attendance_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	booking_id BIGINT NOT NULL,
	user_id BIGINT NOT NULL,
	checkin_id BIGINT NOT NULL,
	attendance_status VARCHAR (10),
	check_in_at TIMESTAMPTZ,
	CONSTRAINT fk_attendance_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    CONSTRAINT fk_attendance_user FOREIGN KEY (user_id) REFERENCES users(user_id),
	CONSTRAINT fk_attendance_checkin FOREIGN KEY (checkin_id) REFERENCES checkins(checkin_id)
);


