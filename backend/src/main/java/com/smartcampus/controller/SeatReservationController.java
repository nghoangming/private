package com.smartcampus.controller;

import com.smartcampus.dto.SeatReservationRequest;
import com.smartcampus.dto.SeatReservationResponse;
import com.smartcampus.dto.SeatResponse;
import com.smartcampus.service.SeatReservationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class SeatReservationController {
    private final SeatReservationService service;

    public SeatReservationController(SeatReservationService service) {
        this.service = service;
    }

    @GetMapping("/class-sessions/{classSessionId}/seats")
    public List<SeatResponse> listSeats(@PathVariable Long classSessionId) {
        return service.listSeats(classSessionId);
    }

    @PostMapping("/seat-reservations")
    @ResponseStatus(HttpStatus.CREATED)
    public SeatReservationResponse create(@Valid @RequestBody SeatReservationRequest request,
                                          @RequestAttribute("authenticatedUserId") Long userId) {
        return service.create(request, userId);
    }

    @GetMapping("/seat-reservations/mine")
    public List<SeatReservationResponse> mine(@RequestAttribute("authenticatedUserId") Long userId) {
        return service.forUser(userId);
    }

    @GetMapping("/seat-reservations/{id}")
    public SeatReservationResponse getById(@PathVariable Long id) {
        return service.getById(id);
    }

    @PatchMapping("/seat-reservations/{id}/cancel")
    public SeatReservationResponse cancel(@PathVariable Long id) {
        return service.cancel(id);
    }
}
