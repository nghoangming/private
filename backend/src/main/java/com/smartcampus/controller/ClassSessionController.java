package com.smartcampus.controller;

import com.smartcampus.auth.AccessService;
import com.smartcampus.dto.ClassSessionRequest;
import com.smartcampus.dto.ClassSessionResponse;
import com.smartcampus.service.ClassSessionService;
import com.smartcampus.service.ReservationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/class-sessions")
public class ClassSessionController {
    private final ClassSessionService service;
    private final ReservationService reservations;
    private final AccessService access;

    public ClassSessionController(ClassSessionService service, ReservationService reservations, AccessService access) {
        this.service = service;
        this.reservations = reservations;
        this.access = access;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ClassSessionResponse create(@Valid @RequestBody ClassSessionRequest request,
                                       @RequestAttribute("authenticatedUserId") Long userId) {
        access.requireRole(userId, "TEACHER");
        access.requireOwnerOrAdmin(userId, reservations.getById(request.bookingId(), "CLASSROOM").userId());
        return service.create(request);
    }

    @GetMapping("/{id}")
    public ClassSessionResponse getById(@PathVariable Long id,
                                        @RequestAttribute("authenticatedUserId") Long userId) {
        ClassSessionResponse session = service.getById(id);
        if (access.hasRole(userId, "TEACHER") && !access.hasRole(userId, "ADMIN")) {
            access.requireOwnerOrAdmin(userId, reservations.getById(session.bookingId(), "CLASSROOM").userId());
        }
        return session;
    }

    @PatchMapping("/{id}/absence")
    public ClassSessionResponse reportAbsence(@PathVariable Long id,
                                              @RequestAttribute("authenticatedUserId") Long userId) {
        access.requireRole(userId, "TEACHER");
        ClassSessionResponse session = service.getById(id);
        access.requireOwnerOrAdmin(userId, reservations.getById(session.bookingId(), "CLASSROOM").userId());
        return service.reportAbsence(id);
    }

    @PatchMapping("/{id}/absence/approve")
    public ClassSessionResponse approveAbsence(@PathVariable Long id,
                                                @RequestAttribute("authenticatedUserId") Long userId) {
        access.requireRole(userId, "ADMIN");
        return service.decideAbsence(id, true);
    }

    @PatchMapping("/{id}/absence/reject")
    public ClassSessionResponse rejectAbsence(@PathVariable Long id,
                                               @RequestAttribute("authenticatedUserId") Long userId) {
        access.requireRole(userId, "ADMIN");
        return service.decideAbsence(id, false);
    }

    @GetMapping
    public List<ClassSessionResponse> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestAttribute("authenticatedUserId") Long userId) {
        List<ClassSessionResponse> sessions;
        if (from != null || to != null) {
            if (from == null || to == null || date != null) throw new IllegalArgumentException("Provide both from and to");
            sessions = service.listBetween(from, to);
        } else {
            sessions = date == null ? service.list() : service.listByDate(date);
        }
        if (!access.hasRole(userId, "TEACHER") || access.hasRole(userId, "ADMIN")) return sessions;
        Set<Long> ownBookingIds = reservations.list(null, "CLASSROOM").stream()
                .filter(booking -> userId.equals(booking.userId()))
                .map(booking -> booking.id()).collect(Collectors.toSet());
        return sessions.stream().filter(session -> ownBookingIds.contains(session.bookingId())).toList();
    }
}
