package com.smartcampus.controller;

import com.smartcampus.service.QrAttendanceService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class QrAttendanceController {
    private final QrAttendanceService service;
    public QrAttendanceController(QrAttendanceService service) { this.service = service; }

    public record QrResponse(Long classSessionId, String token, OffsetDateTime expiresAt) { }
    public record CheckInRequest(@NotBlank String qrCode, Long classSessionId) { }
    public record AttendanceResponse(Long id, Long classSessionId, Long userId, Long seatId,
                                     Integer seatNumber, String status, OffsetDateTime checkedInAt, String studentName) { }

    @PostMapping("/class-sessions/{id}/qr")
    public QrResponse generate(@PathVariable Long id,
            @RequestAttribute("authenticatedUserId") Long userId) {
        return service.generate(id, userId);
    }

    @PostMapping("/attendance/check-in")
    @ResponseStatus(HttpStatus.CREATED)
    public AttendanceResponse checkIn(@Valid @RequestBody CheckInRequest request,
            @RequestAttribute("authenticatedUserId") Long userId) {
        return service.checkIn(request, userId);
    }

    @GetMapping("/attendance")
    public List<AttendanceResponse> list(@RequestParam Long classSessionId,
            @RequestAttribute("authenticatedUserId") Long userId) {
        return service.list(classSessionId, userId);
    }

    @GetMapping("/attendance/mine")
    public List<Long> checkedInSessions(
            @RequestAttribute("authenticatedUserId") Long userId) {
        return service.checkedInSessions(userId);
    }

    @DeleteMapping("/attendance/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@PathVariable Long id,
            @RequestAttribute("authenticatedUserId") Long userId) {
        service.cancel(id, userId);
    }
}
