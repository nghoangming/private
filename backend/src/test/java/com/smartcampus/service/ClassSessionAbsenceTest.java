package com.smartcampus.service;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smartcampus.entity.Booking;
import com.smartcampus.entity.ClassSession;
import com.smartcampus.repository.BookingRepository;
import com.smartcampus.repository.ClassSessionRepository;
import com.smartcampus.repository.RoomRepository;
import com.smartcampus.repository.SeatReservationRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class ClassSessionAbsenceTest {
    @Mock BookingRepository bookings;
    @Mock ClassSessionRepository sessions;
    @Mock RoomRepository rooms;
    @Mock SeatReservationRepository seats;
    @Mock JdbcTemplate jdbc;
    @Mock ClassSession session;
    @Mock Booking booking;

    @Test
    void requestDelegatesToDatabaseWithoutReleasingRoomOrSeats() {
        when(sessions.findById(1L)).thenReturn(Optional.of(session));
        when(session.getId()).thenReturn(1L);
        when(session.getBookingId()).thenReturn(2L);
        when(bookings.findById(2L)).thenReturn(Optional.of(booking));
        when(jdbc.queryForObject(eq("SELECT absence_request_id FROM request_teacher_absence(?, ?, ?)"),
                eq(Long.class), eq(1L), eq(7L), anyString())).thenReturn(9L);
        when(jdbc.queryForObject(eq("SELECT calendar_status FROM class_session_calendar WHERE class_session_id=?"),
                eq(String.class), eq(1L))).thenReturn("SCHEDULED");

        new ClassSessionService(bookings,sessions,rooms,seats,jdbc).reportAbsence(1L,7L);

        verify(booking,never()).cancel();
        verify(seats,never()).cancelActiveForSession(1L);
    }
}
