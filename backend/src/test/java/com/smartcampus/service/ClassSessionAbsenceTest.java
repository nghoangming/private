package com.smartcampus.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smartcampus.entity.Booking;
import com.smartcampus.entity.ClassSession;
import com.smartcampus.repository.BookingRepository;
import com.smartcampus.repository.ClassSessionRepository;
import com.smartcampus.repository.RoomRepository;
import com.smartcampus.repository.SeatReservationRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ClassSessionAbsenceTest {
    @Mock BookingRepository bookings;
    @Mock ClassSessionRepository sessions;
    @Mock RoomRepository rooms;
    @Mock SeatReservationRepository seats;
    @Mock ClassSession session;
    @Mock Booking booking;

    private ClassSessionService service() { return new ClassSessionService(bookings, sessions, rooms, seats); }

    @Test
    void rejectsAbsenceAfterClassEnds() {
        when(sessions.findById(1L)).thenReturn(Optional.of(session));
        when(session.getBookingId()).thenReturn(2L);
        when(bookings.findByIdForUpdate(2L)).thenReturn(Optional.of(booking));
        when(booking.getStatus()).thenReturn("CONFIRMED");
        when(session.getEndTime()).thenReturn(OffsetDateTime.now().minusMinutes(1));

        assertThrows(IllegalArgumentException.class, () -> service().reportAbsence(1L));
        verify(session, never()).requestAbsence();
    }

    @Test
    void requestDoesNotCancelBookingOrSeatsBeforeAdminApproval() {
        when(sessions.findById(1L)).thenReturn(Optional.of(session));
        when(session.getBookingId()).thenReturn(2L);
        when(bookings.findByIdForUpdate(2L)).thenReturn(Optional.of(booking));
        when(booking.getStatus()).thenReturn("CONFIRMED");
        when(session.getEndTime()).thenReturn(OffsetDateTime.now().plusHours(1));
        when(session.getCalendarStatus()).thenReturn("SCHEDULED");
        when(sessions.saveAndFlush(session)).thenReturn(session);
        when(bookings.findById(2L)).thenReturn(Optional.of(booking));

        service().reportAbsence(1L);
        verify(session).requestAbsence();
        verify(booking, never()).cancel();
        verify(seats, never()).cancelActiveForSession(any());
    }

    @Test
    void approvalCancelsBookingAndReservedSeats() {
        when(sessions.findById(1L)).thenReturn(Optional.of(session));
        when(session.getBookingId()).thenReturn(2L);
        when(session.getId()).thenReturn(1L);
        when(bookings.findByIdForUpdate(2L)).thenReturn(Optional.of(booking));
        when(bookings.findById(2L)).thenReturn(Optional.of(booking));
        when(booking.getStatus()).thenReturn("CONFIRMED");
        when(session.getCalendarStatus()).thenReturn("ABSENCE_PENDING");
        when(sessions.saveAndFlush(session)).thenReturn(session);

        service().decideAbsence(1L, true);
        verify(session).approveAbsence();
        verify(seats).cancelActiveForSession(1L);
        verify(booking).cancel();
    }
}
