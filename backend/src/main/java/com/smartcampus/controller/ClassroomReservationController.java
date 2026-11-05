package com.smartcampus.controller;

import com.smartcampus.auth.AccessService;
import com.smartcampus.dto.ReservationRequest;
import com.smartcampus.dto.ReservationResponse;
import com.smartcampus.service.ReservationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for Classroom Reservation endpoints.
 *
 * <pre>
 *   POST   /api/v1/classroom-reservations              → 201 Created  (or 409 Conflict)
 *   GET    /api/v1/classroom-reservations               → 200 OK
 *   GET    /api/v1/classroom-reservations/{id}          → 200 OK  (or 404)
 *   PATCH  /api/v1/classroom-reservations/{id}/cancel   → 200 OK  (or 404)
 * </pre>
 */
@RestController
@RequestMapping("/api/v1/classroom-reservations")
public class ClassroomReservationController {

    private final ReservationService reservationService;
    private final AccessService access;

    public ClassroomReservationController(ReservationService reservationService, AccessService access) {
        this.reservationService = reservationService;
        this.access = access;
    }

    /**
     * Create a classroom reservation.
     * Returns 201 on success, 409 when the time slot conflicts with an existing booking.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReservationResponse create(@Valid @RequestBody ReservationRequest request,
                                      @RequestAttribute("authenticatedUserId") Long userId) {
        access.requireRole(userId, "TEACHER");
        return reservationService.create(request, "CLASSROOM", userId);
    }

    /**
     * List classroom reservations, optionally filtered by {@code status} query param.
     */
    @GetMapping
    public List<ReservationResponse> list(@RequestParam(required = false) String status,
                                          @RequestAttribute("authenticatedUserId") Long userId) {
        List<ReservationResponse> bookings = reservationService.list(status, "CLASSROOM");
        if (access.hasRole(userId, "ADMIN")) return bookings;
        return bookings.stream().filter(booking -> userId.equals(booking.userId())).toList();
    }

    /**
     * Get detail of a single classroom reservation.
     */
    @GetMapping("/{id}")
    public ReservationResponse getById(@PathVariable Long id,
                                       @RequestAttribute("authenticatedUserId") Long userId) {
        ReservationResponse booking = reservationService.getById(id, "CLASSROOM");
        access.requireOwnerOrAdmin(userId, booking.userId());
        return booking;
    }

    /**
     * Cancel a classroom reservation.
     */
    @PatchMapping("/{id}/cancel")
    public ReservationResponse cancel(@PathVariable Long id,
                                      @RequestAttribute("authenticatedUserId") Long userId) {
        access.requireOwnerOrAdmin(userId, reservationService.getById(id, "CLASSROOM").userId());
        return reservationService.cancel(id, "CLASSROOM");
    }

    @PatchMapping("/{id}/approve")
    public ReservationResponse approve(@PathVariable Long id,
                                       @RequestAttribute("authenticatedUserId") Long userId) {
        access.requireRole(userId, "ADMIN");
        return reservationService.decide(id, "CLASSROOM", true);
    }

    @PatchMapping("/{id}/reject")
    public ReservationResponse reject(@PathVariable Long id,
                                      @RequestAttribute("authenticatedUserId") Long userId) {
        access.requireRole(userId, "ADMIN");
        return reservationService.decide(id, "CLASSROOM", false);
    }
}
