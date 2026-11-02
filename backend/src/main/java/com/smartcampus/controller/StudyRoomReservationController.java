package com.smartcampus.controller;

import com.smartcampus.dto.ReservationRequest;
import com.smartcampus.dto.ReservationResponse;
import com.smartcampus.service.ReservationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for Study Room Reservation endpoints.
 *
 * <pre>
 *   POST   /api/v1/study-room-reservations              → 201 Created  (or 409 Conflict)
 *   GET    /api/v1/study-room-reservations               → 200 OK
 *   GET    /api/v1/study-room-reservations/{id}          → 200 OK  (or 404)
 *   PATCH  /api/v1/study-room-reservations/{id}/cancel   → 200 OK  (or 404)
 * </pre>
 */
@RestController
@RequestMapping("/api/v1/study-room-reservations")
public class StudyRoomReservationController {

    private final ReservationService reservationService;

    public StudyRoomReservationController(ReservationService reservationService) {
        this.reservationService = reservationService;
    }

    /**
     * Create a study room reservation.
     * Returns 201 on success, 409 when the time slot conflicts with an existing booking.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReservationResponse create(@Valid @RequestBody ReservationRequest request,
                                      @RequestAttribute("authenticatedUserId") Long userId) {
        return reservationService.create(request, "STUDY", userId);
    }

    /**
     * List study room reservations, optionally filtered by {@code status} query param.
     */
    @GetMapping
    public List<ReservationResponse> list(@RequestParam(required = false) String status) {
        return reservationService.list(status, "STUDY");
    }

    /**
     * Get detail of a single study room reservation.
     */
    @GetMapping("/{id}")
    public ReservationResponse getById(@PathVariable Long id) {
        return reservationService.getById(id, "STUDY");
    }

    /**
     * Cancel a study room reservation.
     */
    @PatchMapping("/{id}/cancel")
    public ReservationResponse cancel(@PathVariable Long id) {
        return reservationService.cancel(id, "STUDY");
    }

    @PatchMapping("/{id}/approve")
    public ReservationResponse approve(@PathVariable Long id) {
        return reservationService.decide(id, "STUDY", true);
    }

    @PatchMapping("/{id}/reject")
    public ReservationResponse reject(@PathVariable Long id) {
        return reservationService.decide(id, "STUDY", false);
    }
}
