package com.smartcampus.service;

import com.smartcampus.dto.ReservationRequest;
import com.smartcampus.dto.ReservationResponse;
import com.smartcampus.entity.Booking;
import com.smartcampus.entity.Room;
import com.smartcampus.exception.ReservationConflictException;
import com.smartcampus.exception.ResourceNotFoundException;
import com.smartcampus.repository.BookingRepository;
import com.smartcampus.repository.ClassSessionRepository;
import com.smartcampus.repository.RoomRepository;
import com.smartcampus.repository.SeatReservationRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.time.OffsetDateTime;

@Service
public class ReservationService {

    /**
     * Placeholder user-id until JWT authentication is wired in.
     * Replace with SecurityContext lookup once the auth layer is added.
     */
    private static final Long ANONYMOUS_USER_ID = 1L;

    private final BookingRepository bookingRepository;
    private final RoomRepository roomRepository;
    private final ClassSessionRepository classSessionRepository;
    private final SeatReservationRepository seatReservationRepository;

    public ReservationService(BookingRepository bookingRepository,
                              RoomRepository roomRepository,
                              ClassSessionRepository classSessionRepository,
                              SeatReservationRepository seatReservationRepository) {
        this.bookingRepository = bookingRepository;
        this.roomRepository = roomRepository;
        this.classSessionRepository = classSessionRepository;
        this.seatReservationRepository = seatReservationRepository;
    }

    // -------------------------------------------------------------------------
    // Create
    // -------------------------------------------------------------------------

    /**
     * Creates a reservation.
     *
     * <p>Validates that:
     * <ul>
     *   <li>startTime is strictly before endTime (400)
     *   <li>the room exists (404)
     *   <li>no active booking for the same room overlaps the requested interval (409)
     * </ul>
     *
     * @throws IllegalArgumentException        400 – invalid time range
     * @throws ResourceNotFoundException       404 – room not found
     * @throws ReservationConflictException    409 – time overlap
     */
    @Transactional
    public ReservationResponse create(ReservationRequest request, String roomType) {
        return create(request, roomType, ANONYMOUS_USER_ID);
    }

    @Transactional
    public ReservationResponse create(ReservationRequest request, String roomType, Long userId) {
        if (!request.startTime().isBefore(request.endTime())) {
            throw new IllegalArgumentException("startTime must be strictly before endTime");
        }
        if (!request.startTime().isAfter(OffsetDateTime.now())) {
            throw new IllegalArgumentException("startTime must be in the future");
        }

        // Verify room exists
        Room room = roomRepository.findByIdForUpdate(request.roomId())
                .orElseThrow(() -> new ResourceNotFoundException("Room not found: " + request.roomId()));
        if (!"ACTIVE".equalsIgnoreCase(room.getStatus())) {
            throw new IllegalArgumentException("Room is not active: " + request.roomId());
        }
        if (!RoomCategory.matches(room, roomType)) {
            throw new IllegalArgumentException("Room is not of type " + roomType);
        }

        // Conflict detection (overlap rule)
        List<Booking> conflicts = bookingRepository.findOverlappingBookings(
                request.roomId(), request.startTime(), request.endTime());
        if (!conflicts.isEmpty()) {
            throw new ReservationConflictException(
                    "Room " + request.roomId() + " is already booked during the requested time slot");
        }

        Booking booking = Booking.create(
                userId,
                request.roomId(),
                request.startTime(),
                request.endTime());

        try {
            // Flush here so the database exclusion constraint is evaluated before
            // this method returns. It closes the race left by the overlap query.
            return toResponse(bookingRepository.saveAndFlush(booking));
        } catch (DataIntegrityViolationException ex) {
            if (DatabaseConflict.hasSqlState(ex, "23P01")) {
                throw new ReservationConflictException(
                        "Room " + request.roomId() + " is already booked during the requested time slot");
            }
            throw ex;
        }
    }

    // -------------------------------------------------------------------------
    // List
    // -------------------------------------------------------------------------

    /**
     * Returns all reservations, optionally filtered by status.
     */
    @Transactional(readOnly = true)
    public List<ReservationResponse> list(String status, String roomType) {
        List<Long> roomIds = roomRepository.findAll().stream()
                .filter(room -> RoomCategory.matches(room, roomType))
                .map(Room::getId).toList();
        if (roomIds.isEmpty()) {
            return List.of();
        }
        List<Booking> bookings = bookingRepository.findByRoomIdInOrderByCreatedAtDesc(roomIds);
        if (status != null && !status.isBlank()) {
            bookings = bookings.stream().filter(b -> b.getStatus().equalsIgnoreCase(status)).toList();
        }

        return bookings.stream().map(this::toResponse).toList();
    }

    // -------------------------------------------------------------------------
    // Detail
    // -------------------------------------------------------------------------

    /**
     * Returns a single reservation by id.
     *
     * @throws ResourceNotFoundException 404
     */
    @Transactional(readOnly = true)
    public ReservationResponse getById(Long id, String roomType) {
        Booking booking = findBooking(id);
        assertRoomType(booking, roomType);
        return toResponse(booking);
    }

    // -------------------------------------------------------------------------
    // Cancel
    // -------------------------------------------------------------------------

    /**
     * Cancels a reservation by id.
     *
     * @throws ResourceNotFoundException 404
     * @throws IllegalArgumentException  400 – already cancelled
     */
    @Transactional
    public ReservationResponse cancel(Long id, String roomType) {
        Booking booking = bookingRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found: " + id));
        assertRoomType(booking, roomType);
        if (!"PENDING".equals(booking.getStatus()) && !"CONFIRMED".equals(booking.getStatus())) {
            throw new IllegalArgumentException("Reservation " + id + " is not active");
        }
        booking.cancel();
        classSessionRepository.findByBookingId(id)
                .ifPresent(session -> seatReservationRepository.cancelActiveForSession(session.getId()));
        return toResponse(bookingRepository.save(booking));
    }

    @Transactional
    public ReservationResponse decide(Long id, String roomType, boolean approve) {
        Booking booking = bookingRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found: " + id));
        assertRoomType(booking, roomType);
        if (!"PENDING".equals(booking.getStatus())) {
            throw new IllegalArgumentException("Only pending reservations can be reviewed");
        }
        if (approve) {
            booking.approve();
        } else {
            booking.reject();
            classSessionRepository.findByBookingId(id)
                    .ifPresent(session -> seatReservationRepository.cancelActiveForSession(session.getId()));
        }
        return toResponse(bookingRepository.saveAndFlush(booking));
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private Booking findBooking(Long id) {
        return bookingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reservation not found: " + id));
    }

    private void assertRoomType(Booking booking, String roomType) {
        Room room = roomRepository.findById(booking.getRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("Room not found: " + booking.getRoomId()));
        if (!RoomCategory.matches(room, roomType)) {
            throw new ResourceNotFoundException("Reservation not found: " + booking.getId());
        }
    }

    private ReservationResponse toResponse(Booking b) {
        return new ReservationResponse(
                b.getId(),
                b.getUserId(),
                b.getRoomId(),
                b.getStartTime(),
                b.getEndTime(),
                b.getStatus(),
                b.getCreatedAt());
    }

}
