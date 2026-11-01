package com.smartcampusmock;

import com.smartcampus.dto.ReservationRequest;
import com.smartcampus.dto.ReservationResponse;
import com.smartcampus.dto.RoomResponse;
import com.smartcampus.dto.RoomScheduleResponse;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1")
public class MockApiController {
    private static final ZoneId CAMPUS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final List<RoomResponse> rooms = List.of(
            new RoomResponse(1L, "A101", "Phòng lý thuyết A101", "Tòa A · Tầng 1", "ACTIVE", "THEORY"),
            new RoomResponse(2L, "A205", "Phòng lý thuyết A205", "Tòa A · Tầng 2", "ACTIVE", "THEORY"),
            new RoomResponse(3L, "B204", "Phòng thực hành B204", "Tòa B · Tầng 2", "ACTIVE", "LAB"),
            new RoomResponse(4L, "B310", "Phòng thực hành B310", "Tòa B · Tầng 3", "MAINTENANCE", "LAB"),
            new RoomResponse(5L, "C301", "Phòng tự học C301", "Tòa C · Tầng 3", "ACTIVE", "STUDY"),
            new RoomResponse(6L, "C402", "Phòng tự học C402", "Tòa C · Tầng 4", "ACTIVE", "STUDY"));
    private final List<ReservationResponse> reservations = new ArrayList<>();
    private final AtomicLong nextId = new AtomicLong(1000);

    @GetMapping("/health") public String health() { return "OK (mock)"; }
    @GetMapping("/rooms") public List<RoomResponse> rooms() { return rooms; }
    @GetMapping("/rooms/{id}") public RoomResponse room(@PathVariable Long id) { return findRoom(id); }
    @GetMapping("/rooms/{id}/schedule") public synchronized List<RoomScheduleResponse> schedule(@PathVariable Long id, @RequestParam LocalDate date) {
        findRoom(id);
        return reservations.stream().filter(r -> r.roomId().equals(id) && active(r) && r.startTime().atZoneSameInstant(CAMPUS_ZONE).toLocalDate().equals(date))
                .map(r -> new RoomScheduleResponse(r.id(), r.startTime(), r.endTime(), r.status())).toList();
    }
    @GetMapping("/rooms/availability") public synchronized List<RoomResponse> availability(@RequestParam LocalDate date, @RequestParam LocalTime startTime, @RequestParam LocalTime endTime) {
        if (!startTime.isBefore(endTime)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid interval");
        OffsetDateTime start = date.atTime(startTime).atZone(CAMPUS_ZONE).toOffsetDateTime();
        OffsetDateTime end = date.atTime(endTime).atZone(CAMPUS_ZONE).toOffsetDateTime();
        return rooms.stream().filter(r -> "ACTIVE".equals(r.status()) && reservations.stream().noneMatch(b -> b.roomId().equals(r.id()) && active(b) && overlaps(b, start, end))).toList();
    }
    @GetMapping("/{kind:classroom-reservations|study-room-reservations}") public synchronized List<ReservationResponse> list(@PathVariable String kind, @RequestParam(required = false) String status) {
        return reservations.stream().filter(r -> matchesKind(r.roomId(), kind) && (status == null || status.equalsIgnoreCase(r.status()))).toList();
    }
    @PostMapping("/{kind:classroom-reservations|study-room-reservations}") @ResponseStatus(HttpStatus.CREATED)
    public synchronized ReservationResponse create(@PathVariable String kind, @RequestBody ReservationRequest request, @RequestHeader(value = "X-Demo-User-Id", defaultValue = "1") Long userId) {
        RoomResponse room = findRoom(request.roomId());
        if (!matchesKind(room.id(), kind)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wrong room type");
        if (!"ACTIVE".equals(room.status()) || request.startTime() == null || request.endTime() == null || !request.startTime().isBefore(request.endTime())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid reservation");
        if (reservations.stream().anyMatch(r -> r.roomId().equals(room.id()) && active(r) && overlaps(r, request.startTime(), request.endTime()))) throw new ResponseStatusException(HttpStatus.CONFLICT, "Room already booked");
        ReservationResponse created = new ReservationResponse(nextId.incrementAndGet(), userId, room.id(), request.startTime(), request.endTime(), "PENDING", OffsetDateTime.now());
        reservations.add(created); return created;
    }
    @GetMapping("/{kind:classroom-reservations|study-room-reservations}/{id}") public synchronized ReservationResponse reservation(@PathVariable String kind, @PathVariable Long id) { return findReservation(kind, id); }
    @PatchMapping("/{kind:classroom-reservations|study-room-reservations}/{id}/cancel") public synchronized ReservationResponse cancel(@PathVariable String kind, @PathVariable Long id) {
        ReservationResponse old = findReservation(kind, id);
        if (!active(old)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reservation is not active");
        ReservationResponse updated = new ReservationResponse(old.id(), old.userId(), old.roomId(), old.startTime(), old.endTime(), "CANCELLED", old.createdAt());
        reservations.remove(old); reservations.add(updated); return updated;
    }
    @PatchMapping("/{kind:classroom-reservations|study-room-reservations}/{id}/{decision:approve|reject}")
    public synchronized ReservationResponse review(@PathVariable String kind, @PathVariable Long id, @PathVariable String decision) {
        ReservationResponse old = findReservation(kind, id);
        if (!"PENDING".equals(old.status())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only pending reservations can be reviewed");
        ReservationResponse updated = new ReservationResponse(old.id(), old.userId(), old.roomId(), old.startTime(), old.endTime(),
                "approve".equals(decision) ? "CONFIRMED" : "REJECTED", old.createdAt());
        reservations.remove(old); reservations.add(updated); return updated;
    }
    private RoomResponse findRoom(Long id) { return rooms.stream().filter(r -> r.id().equals(id)).findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found")); }
    private ReservationResponse findReservation(String kind, Long id) { return reservations.stream().filter(r -> r.id().equals(id) && matchesKind(r.roomId(), kind)).findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found")); }
    private boolean matchesKind(Long roomId, String kind) { boolean study = "STUDY".equals(findRoom(roomId).type()); return kind.equals("study-room-reservations") == study; }
    private boolean active(ReservationResponse r) { return "PENDING".equals(r.status()) || "CONFIRMED".equals(r.status()); }
    private boolean overlaps(ReservationResponse r, OffsetDateTime start, OffsetDateTime end) { return r.startTime().isBefore(end) && r.endTime().isAfter(start); }
}
