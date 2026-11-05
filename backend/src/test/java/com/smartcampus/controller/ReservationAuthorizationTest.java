package com.smartcampus.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smartcampus.auth.AccessService;
import com.smartcampus.dto.ClassSessionRequest;
import com.smartcampus.dto.ClassSessionResponse;
import com.smartcampus.dto.ReservationResponse;
import com.smartcampus.dto.SeatReservationResponse;
import com.smartcampus.service.ClassSessionService;
import com.smartcampus.service.ReservationService;
import com.smartcampus.service.SeatReservationService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ReservationAuthorizationTest {
    @Mock JdbcTemplate jdbc;
    @Mock ReservationService reservations;
    @Mock ClassSessionService sessions;
    @Mock SeatReservationService seats;

    private AccessService access() { return new AccessService(jdbc); }

    private ReservationResponse booking(long id, long owner) {
        return new ReservationResponse(id, owner, 20L, null, null, "PENDING", null);
    }

    private void role(long userId, String role, boolean hasRole) {
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(userId), eq(role)))
                .thenReturn(hasRole ? 1 : 0);
    }

    @Test
    void teacherSeesOnlyOwnClassroomBookingsWhileAdminSeesAll() {
        when(reservations.list(null, "CLASSROOM")).thenReturn(List.of(booking(1, 10), booking(2, 11)));
        role(10, "ADMIN", false);
        role(99, "ADMIN", true);
        ClassroomReservationController controller = new ClassroomReservationController(reservations, access());

        assertEquals(List.of(booking(1, 10)), controller.list(null, 10L));
        assertEquals(2, controller.list(null, 99L).size());
    }

    @Test
    void foreignUserCannotReadOrCancelBooking() {
        when(reservations.getById(1L, "STUDY")).thenReturn(booking(1, 10));
        role(11, "ADMIN", false);
        StudyRoomReservationController controller = new StudyRoomReservationController(reservations, access());

        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
                () -> controller.getById(1L, 11L)).getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
                () -> controller.cancel(1L, 11L)).getStatusCode());
        verify(reservations, never()).cancel(1L, "STUDY");
    }

    @Test
    void onlyAdminCanReviewBookings() {
        role(10, "ADMIN", false);
        ClassroomReservationController controller = new ClassroomReservationController(reservations, access());

        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
                () -> controller.approve(1L, 10L)).getStatusCode());
        verify(reservations, never()).decide(1L, "CLASSROOM", true);
    }

    @Test
    void bookingCreationRequiresTheCorrectRole() {
        role(10, "TEACHER", false);
        role(11, "STUDENT", false);
        ClassroomReservationController classrooms = new ClassroomReservationController(reservations, access());
        StudyRoomReservationController studyRooms = new StudyRoomReservationController(reservations, access());

        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
                () -> classrooms.create(null, 10L)).getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
                () -> studyRooms.create(null, 11L)).getStatusCode());
    }

    @Test
    void teacherCannotCreateSessionFromAnotherTeachersBooking() {
        role(10, "TEACHER", true);
        role(10, "ADMIN", false);
        when(reservations.getById(1L, "CLASSROOM")).thenReturn(booking(1, 11));
        ClassSessionController controller = new ClassSessionController(sessions, reservations, access());
        ClassSessionRequest request = new ClassSessionRequest(1L, "IT001", "Test");

        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
                () -> controller.create(request, 10L)).getStatusCode());
        verify(sessions, never()).create(request);
    }

    @Test
    void teacherSessionListContainsOnlyOwnBookings() {
        role(10, "TEACHER", true);
        role(10, "ADMIN", false);
        ClassSessionResponse own = new ClassSessionResponse(1L, 100L, "IT001", "One", 20L, null, null, null);
        ClassSessionResponse foreign = new ClassSessionResponse(2L, 101L, "IT002", "Two", 21L, null, null, null);
        when(sessions.list()).thenReturn(List.of(own, foreign));
        when(reservations.list(null, "CLASSROOM")).thenReturn(List.of(booking(100, 10), booking(101, 11)));
        ClassSessionController controller = new ClassSessionController(sessions, reservations, access());

        assertEquals(List.of(own), controller.list(null, null, null, 10L));
    }

    @Test
    void studentCannotReadAnotherStudentsSeatReservation() {
        when(seats.getById(1L)).thenReturn(new SeatReservationResponse(1L, 2L, 3L, 10L, 20L, "CONFIRMED", null));
        role(11, "ADMIN", false);
        SeatReservationController controller = new SeatReservationController(seats, access());

        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
                () -> controller.getById(1L, 11L)).getStatusCode());
    }
}
