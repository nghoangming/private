package com.smartcampus.service;

import com.smartcampus.dto.SeatReservationRequest;
import com.smartcampus.entity.Booking;
import com.smartcampus.entity.ClassSession;
import com.smartcampus.entity.Seat;
import com.smartcampus.entity.SeatReservation;
import com.smartcampus.exception.SeatConflictException;
import com.smartcampus.repository.BookingRepository;
import com.smartcampus.repository.ClassSessionRepository;
import com.smartcampus.repository.SeatRepository;
import com.smartcampus.repository.SeatReservationRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeatReservationServiceTest {
    @Mock ClassSessionRepository classSessions;
    @Mock BookingRepository bookings;
    @Mock SeatRepository seats;
    @Mock SeatReservationRepository reservations;
    @Mock JdbcTemplate jdbc;
    @Mock ClassSession session;
    @Mock Booking booking;
    @Mock Seat seat;
    @Mock SeatReservation reservation;

    private SeatReservationService service;
    private final SeatReservationRequest request = new SeatReservationRequest(20L, 30L);

    @BeforeEach
    void setUp() {
        service = new SeatReservationService(classSessions, bookings, seats, reservations, jdbc);
    }

    private void activeSessionAndSeat() {
        when(classSessions.findById(20L)).thenReturn(Optional.of(session));
        when(session.getBookingId()).thenReturn(10L);
        when(session.getRoomId()).thenReturn(40L);
        when(session.getId()).thenReturn(20L);
        when(bookings.findById(10L)).thenReturn(Optional.of(booking));
        when(booking.getStatus()).thenReturn("CONFIRMED");
        when(booking.getEndTime()).thenReturn(OffsetDateTime.now().plusDays(1));
        when(seats.findById(30L)).thenReturn(Optional.of(seat));
        when(seat.getRoomId()).thenReturn(40L);
        when(seat.getStatus()).thenReturn("AVAILABLE");
        when(seat.getId()).thenReturn(30L);
    }

    @Test
    void rejectsSecondSeatOnlyWithinSameSession() {
        activeSessionAndSeat();
        when(reservations.existsByClassSessionIdAndUserIdAndStatus(20L, 1L, "CONFIRMED"))
                .thenReturn(true);
        assertThrows(SeatConflictException.class, () -> service.create(request, 1L));
    }

    @Test
    void confirmsHoldThroughDatabaseFunctions() {
        activeSessionAndSeat();
        when(jdbc.queryForObject("SELECT seat_reservation_id FROM hold_class_seat(?,?,?)",
                Long.class, 20L, 30L, 1L)).thenReturn(50L);
        when(jdbc.queryForObject("SELECT seat_reservation_id FROM confirm_class_seat(?,?)",
                Long.class, 50L, 1L)).thenReturn(50L);
        when(reservations.findById(50L)).thenReturn(Optional.of(reservation));
        when(reservation.getStatus()).thenReturn("CONFIRMED");

        assertEquals("CONFIRMED", service.create(request, 1L).status());
        verify(jdbc).queryForObject("SELECT seat_reservation_id FROM hold_class_seat(?,?,?)",
                Long.class, 20L, 30L, 1L);
        verify(jdbc).queryForObject("SELECT seat_reservation_id FROM confirm_class_seat(?,?)",
                Long.class, 50L, 1L);
    }
}
