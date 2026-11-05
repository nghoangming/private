package com.smartcampus.controller;

import com.smartcampus.dto.RoomResponse;
import com.smartcampus.dto.RoomScheduleResponse;
import com.smartcampus.dto.RoomWriteRequest;
import com.smartcampus.service.RoomService;
import com.smartcampus.service.RoomWriteService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.LocalTime;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rooms")
public class RoomController {

    private final RoomService roomService;
    private final RoomWriteService roomWriteService;

    public RoomController(RoomService roomService, RoomWriteService roomWriteService) {
        this.roomService = roomService;
        this.roomWriteService = roomWriteService;
    }

    @PostMapping
    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public RoomResponse create(@Valid @RequestBody RoomWriteRequest request,
                               @RequestAttribute("authenticatedUserId") Long userId) {
        return roomWriteService.create(request, userId);
    }

    @RequestMapping(value = "/{id}", method = {RequestMethod.PUT, RequestMethod.PATCH})
    public RoomResponse update(@PathVariable Long id, @Valid @RequestBody RoomWriteRequest request,
                               @RequestAttribute("authenticatedUserId") Long userId) {
        return roomWriteService.update(id, request, userId);
    }

    @GetMapping
    public List<RoomResponse> getRooms() {
        return roomService.getRooms();
    }

    @GetMapping("/{id}")
    public RoomResponse getRoomById(@PathVariable Long id) {
        return roomService.getRoomById(id);
    }

    @GetMapping("/{id}/schedule")
    public List<RoomScheduleResponse> getSchedule(
            @PathVariable Long id,
            @RequestParam LocalDate date) {
        return roomService.getSchedule(id, date);
    }

    @GetMapping("/availability")
    public List<RoomResponse> getAvailableRooms(
            @RequestParam LocalDate date,
            @RequestParam LocalTime startTime,
            @RequestParam LocalTime endTime) {
        if (!startTime.isBefore(endTime)) {
            throw new IllegalArgumentException("startTime must be earlier than endTime");
        }
        return roomService.getAvailableRooms(date, startTime, endTime);
    }
}
