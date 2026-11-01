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
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.postgresql.util.PSQLException;
import org.postgresql.util.ServerErrorMessage;
import org.springframework.dao.DataIntegrityViolationException;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeatReservationServiceTest {
    @Mock ClassSessionRepository classSessions;
    @Mock BookingRepository bookings;
    @Mock SeatRepository seats;
    @Mock SeatReservationRepository reservations;
    @Mock ClassSession session;
    @Mock Booking booking;
    @Mock Seat seat;

    private SeatReservationService service;
    private final SeatReservationRequest request = new SeatReservationRequest(20L, 30L);

    @BeforeEach
    void setUp() {
        service = new SeatReservationService(classSessions, bookings, seats, reservations);
    }

    private void activeSessionAndSeat() {
        when(classSessions.findById(20L)).thenReturn(Optional.of(session));
        when(session.getBookingId()).thenReturn(10L);
        when(session.getRoomId()).thenReturn(40L);
        when(session.getId()).thenReturn(20L);
        when(bookings.findByIdForUpdate(10L)).thenReturn(Optional.of(booking));
        when(booking.getStatus()).thenReturn("CONFIRMED");
        when(seats.findByIdForUpdate(30L)).thenReturn(Optional.of(seat));
        when(seat.getRoomId()).thenReturn(40L);
        when(seat.getStatus()).thenReturn("AVAILABLE");
        when(seat.getId()).thenReturn(30L);
    }

    @Test
    void rejectsSeatAlreadyReservedInSession() {
        activeSessionAndSeat();
        when(reservations.existsByClassSessionIdAndSeatIdAndStatus(20L, 30L, "CONFIRMED"))
                .thenReturn(true);

        assertThrows(SeatConflictException.class, () -> service.create(request));
        verify(reservations, never()).saveAndFlush(any());
    }

    @Test
    void rejectsSecondSeatForSameUserInSession() {
        activeSessionAndSeat();
        when(reservations.existsByClassSessionIdAndUserIdAndStatus(20L, 1L, "CONFIRMED"))
                .thenReturn(true);

        assertThrows(SeatConflictException.class, () -> service.create(request));
        verify(reservations, never()).saveAndFlush(any());
    }

    @Test
    void translatesDatabaseUniqueRaceForSeatAndUser() {
        activeSessionAndSeat();
        for (String constraint : new String[] {
                "uq_seat_reservations_active_seat", "uq_seat_reservations_active_user" }) {
            ServerErrorMessage detail = org.mockito.Mockito.mock(ServerErrorMessage.class);
            when(detail.getSQLState()).thenReturn("23505");
            when(detail.getConstraint()).thenReturn(constraint);
            DataIntegrityViolationException conflict = new DataIntegrityViolationException(
                    "duplicate", new PSQLException(detail));
            when(reservations.saveAndFlush(any(SeatReservation.class)))
                    .thenThrow(conflict);

            assertThrows(SeatConflictException.class, () -> service.create(request));
        }
    }

    @Test
    void leavesOtherIntegrityFailuresUnchanged() {
        activeSessionAndSeat();
        DataIntegrityViolationException failure = new DataIntegrityViolationException("foreign key");
        when(reservations.saveAndFlush(any(SeatReservation.class))).thenThrow(failure);

        assertSame(failure, assertThrows(DataIntegrityViolationException.class,
                () -> service.create(request)));
    }
}
