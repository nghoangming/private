package com.smartcampus.controller;

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

    public ClassroomReservationController(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    /**
     * Create a classroom reservation.
     * Returns 201 on success, 409 when the time slot conflicts with an existing booking.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReservationResponse create(@Valid @RequestBody ReservationRequest request,
                                      @RequestHeader(value = "X-Demo-User-Id", defaultValue = "1") Long userId) {
        return reservationService.create(request, "CLASSROOM", userId);
    }

    /**
     * List classroom reservations, optionally filtered by {@code status} query param.
     */
    @GetMapping
    public List<ReservationResponse> list(@RequestParam(required = false) String status) {
        return reservationService.list(status, "CLASSROOM");
    }

    /**
     * Get detail of a single classroom reservation.
     */
    @GetMapping("/{id}")
    public ReservationResponse getById(@PathVariable Long id) {
        return reservationService.getById(id, "CLASSROOM");
    }

    /**
     * Cancel a classroom reservation.
     */
    @PatchMapping("/{id}/cancel")
    public ReservationResponse cancel(@PathVariable Long id) {
        return reservationService.cancel(id, "CLASSROOM");
    }

    @PatchMapping("/{id}/approve")
    public ReservationResponse approve(@PathVariable Long id) {
        return reservationService.decide(id, "CLASSROOM", true);
    }

    @PatchMapping("/{id}/reject")
    public ReservationResponse reject(@PathVariable Long id) {
        return reservationService.decide(id, "CLASSROOM", false);
    }
}
