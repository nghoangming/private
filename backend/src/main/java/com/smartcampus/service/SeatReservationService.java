package com.smartcampus.service;

import com.smartcampus.dto.SeatReservationRequest;
import com.smartcampus.dto.SeatReservationResponse;
import com.smartcampus.dto.SeatResponse;
import com.smartcampus.entity.Booking;
import com.smartcampus.entity.ClassSession;
import com.smartcampus.entity.Seat;
import com.smartcampus.entity.SeatReservation;
import com.smartcampus.exception.ResourceNotFoundException;
import com.smartcampus.exception.SeatConflictException;
import com.smartcampus.repository.BookingRepository;
import com.smartcampus.repository.ClassSessionRepository;
import com.smartcampus.repository.SeatRepository;
import com.smartcampus.repository.SeatReservationRepository;
import java.util.List;
import java.util.Set;
import java.util.HashSet;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SeatReservationService {
    // The authentication layer has not been implemented yet.
    private static final Long ANONYMOUS_USER_ID = 1L;

    private final ClassSessionRepository classSessionRepository;
    private final BookingRepository bookingRepository;
    private final SeatRepository seatRepository;
    private final SeatReservationRepository seatReservationRepository;

    public SeatReservationService(ClassSessionRepository classSessionRepository,
                                  BookingRepository bookingRepository,
                                  SeatRepository seatRepository,
                                  SeatReservationRepository seatReservationRepository) {
        this.classSessionRepository = classSessionRepository;
        this.bookingRepository = bookingRepository;
        this.seatRepository = seatRepository;
        this.seatReservationRepository = seatReservationRepository;
    }

    @Transactional(readOnly = true)
    public List<SeatResponse> listSeats(Long classSessionId) {
        ClassSession session = findSession(classSessionId);
        requireHeldSession(session);
        Booking booking = bookingRepository.findById(session.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found: " + session.getBookingId()));
        if (!"PENDING".equals(booking.getStatus()) && !"CONFIRMED".equals(booking.getStatus())) {
            throw new IllegalArgumentException("Class session booking is not active");
        }
        Set<Long> reservedIds = new HashSet<>(seatReservationRepository.findConfirmedSeatIds(session.getId()));
        return seatRepository.findByRoomIdOrderBySeatNumber(session.getRoomId()).stream()
                .map(seat -> new SeatResponse(seat.getId(), seat.getRoomId(),
                        seat.getSeatNumber(), reservedIds.contains(seat.getId())
                                ? "RESERVED" : seat.getStatus()))
                .toList();
    }

    @Transactional
    public SeatReservationResponse create(SeatReservationRequest request) {
        return create(request, ANONYMOUS_USER_ID);
    }

    @Transactional
    public SeatReservationResponse create(SeatReservationRequest request, Long userId) {
        ClassSession session = findSession(request.classSessionId());
        requireHeldSession(session);
        Booking booking = bookingRepository.findByIdForUpdate(session.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found: " + session.getBookingId()));
        if (!"PENDING".equals(booking.getStatus()) && !"CONFIRMED".equals(booking.getStatus())) {
            throw new IllegalArgumentException("Class session booking is not active");
        }

        Seat seat = seatRepository.findByIdForUpdate(request.seatId())
                .orElseThrow(() -> new ResourceNotFoundException("Seat not found: " + request.seatId()));
        if (!seat.getRoomId().equals(session.getRoomId())) {
            throw new IllegalArgumentException("Seat does not belong to the class session room");
        }
        if (!"AVAILABLE".equalsIgnoreCase(seat.getStatus())) {
            throw new IllegalArgumentException("Seat is not available");
        }
        if (seatReservationRepository.existsByClassSessionIdAndSeatIdAndStatus(
                session.getId(), seat.getId(), "CONFIRMED")) {
            throw new SeatConflictException("Seat is already reserved for this class session");
        }
        if (seatReservationRepository.existsByClassSessionIdAndUserIdAndStatus(
                session.getId(), userId, "CONFIRMED")) {
            throw new SeatConflictException("User already has a seat in this class session");
        }

        try {
            SeatReservation reservation = SeatReservation.create(
                    session.getId(), seat.getId(), userId, session.getRoomId());
            return toResponse(seatReservationRepository.saveAndFlush(reservation));
        } catch (DataIntegrityViolationException ex) {
            if (DatabaseConflict.isConstraint(ex, "23505", "uq_seat_reservations_active_seat")) {
                throw new SeatConflictException("Seat is already reserved for this class session");
            }
            if (DatabaseConflict.isConstraint(ex, "23505", "uq_seat_reservations_active_user")) {
                throw new SeatConflictException("User already has a seat in this class session");
            }
            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public SeatReservationResponse getById(Long id) {
        return toResponse(seatReservationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Seat reservation not found: " + id)));
    }

    @Transactional(readOnly = true)
    public List<SeatReservationResponse> forUser(Long userId) {
        return seatReservationRepository.findByUserIdAndStatus(userId, "CONFIRMED").stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public SeatReservationResponse cancel(Long id, Long userId) {
        SeatReservation reservation = seatReservationRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Seat reservation not found: " + id));
        if (!reservation.getUserId().equals(userId)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN, "Not your seat reservation");
        }
        if ("CANCELLED".equals(reservation.getStatus())) {
            throw new IllegalArgumentException("Seat reservation is already cancelled: " + id);
        }
        reservation.cancel();
        return toResponse(seatReservationRepository.saveAndFlush(reservation));
    }

    private ClassSession findSession(Long id) {
        return classSessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Class session not found: " + id));
    }

    private void requireHeldSession(ClassSession session) {
        if ("ABSENT".equals(session.getCalendarStatus())) {
            throw new IllegalArgumentException("Teacher reported absence for this class session");
        }
    }

    private SeatReservationResponse toResponse(SeatReservation reservation) {
        return new SeatReservationResponse(reservation.getId(), reservation.getClassSessionId(),
                reservation.getSeatId(), reservation.getUserId(), reservation.getRoomId(),
                reservation.getStatus(), reservation.getCreatedAt());
    }
}
