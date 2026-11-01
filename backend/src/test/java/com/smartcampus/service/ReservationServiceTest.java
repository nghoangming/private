package com.smartcampus.service;

import com.smartcampus.dto.ReservationRequest;
import com.smartcampus.entity.Booking;
import com.smartcampus.entity.ClassSession;
import com.smartcampus.entity.Room;
import com.smartcampus.exception.ReservationConflictException;
import com.smartcampus.repository.BookingRepository;
import com.smartcampus.repository.ClassSessionRepository;
import com.smartcampus.repository.RoomRepository;
import com.smartcampus.repository.SeatReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ReservationServiceTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private RoomRepository roomRepository;

    @Mock
    private ClassSessionRepository classSessionRepository;

    @Mock
    private SeatReservationRepository seatReservationRepository;

    @Mock
    private Room room;

    private ReservationService reservationService;
    private ReservationRequest request;

    @BeforeEach
    void setUp() {
        reservationService = new ReservationService(bookingRepository, roomRepository,
                classSessionRepository, seatReservationRepository);
        request = new ReservationRequest(
                10L,
                null,
                OffsetDateTime.now().plusDays(2),
                OffsetDateTime.now().plusDays(2).plusHours(2),
                null);

    }

    private void roomWithoutConflicts() {
        when(roomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(room));
        when(room.getStatus()).thenReturn("ACTIVE");
        when(room.getCode()).thenReturn("A101");
        when(bookingRepository.findOverlappingBookings(any(), any(), any()))
                .thenReturn(List.of());
    }

    @Test
    void createTranslatesPostgresExclusionViolationToReservationConflict() {
        roomWithoutConflicts();
        SQLException databaseError = new SQLException(
                "conflicts with existing key", "23P01");
        when(bookingRepository.saveAndFlush(any(Booking.class)))
                .thenThrow(new DataIntegrityViolationException("insert failed", databaseError));

        assertThrows(ReservationConflictException.class,
                () -> reservationService.create(request, "CLASSROOM"));
    }

    @Test
    void createDoesNotMislabelOtherIntegrityViolationsAsReservationConflicts() {
        roomWithoutConflicts();
        DataIntegrityViolationException integrityError = new DataIntegrityViolationException(
                "foreign key failed", new SQLException("missing user", "23503"));
        when(bookingRepository.saveAndFlush(any(Booking.class))).thenThrow(integrityError);

        DataIntegrityViolationException thrown = assertThrows(
                DataIntegrityViolationException.class,
                () -> reservationService.create(request, "CLASSROOM"));

        assertSame(integrityError, thrown);
    }

    @Test
    void rejectsInactiveRoom() {
        when(roomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(room));
        when(room.getStatus()).thenReturn("MAINTENANCE");
        assertThrows(IllegalArgumentException.class,
                () -> reservationService.create(request, "CLASSROOM"));
    }

    @Test
    void rejectsWrongRoomType() {
        when(roomRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(room));
        when(room.getStatus()).thenReturn("ACTIVE");
        when(room.getCode()).thenReturn("C301");
        assertThrows(IllegalArgumentException.class,
                () -> reservationService.create(request, "CLASSROOM"));
    }

    @Test
    void cancellingBookingCancelsActiveSessionSeats() {
        Booking booking = org.mockito.Mockito.mock(Booking.class);
        ClassSession session = org.mockito.Mockito.mock(ClassSession.class);
        when(bookingRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(booking));
        when(booking.getRoomId()).thenReturn(10L);
        when(roomRepository.findById(10L)).thenReturn(Optional.of(room));
        when(room.getCode()).thenReturn("A101");
        when(booking.getStatus()).thenReturn("CONFIRMED");
        when(classSessionRepository.findByBookingId(10L)).thenReturn(Optional.of(session));
        when(session.getId()).thenReturn(20L);
        when(bookingRepository.save(booking)).thenReturn(booking);

        reservationService.cancel(10L, "CLASSROOM");

        verify(booking).cancel();
        verify(seatReservationRepository).cancelActiveForSession(20L);
    }
}
