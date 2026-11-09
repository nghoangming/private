package com.smartcampus.service;

import com.smartcampus.dto.ClassSessionRequest;
import com.smartcampus.dto.ClassSessionResponse;
import com.smartcampus.entity.Booking;
import com.smartcampus.entity.ClassSession;
import com.smartcampus.exception.ReservationConflictException;
import com.smartcampus.exception.ResourceNotFoundException;
import com.smartcampus.repository.BookingRepository;
import com.smartcampus.repository.ClassSessionRepository;
import com.smartcampus.repository.RoomRepository;
import com.smartcampus.repository.SeatReservationRepository;
import java.util.List;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.OffsetDateTime;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ClassSessionService {
    private final BookingRepository bookingRepository;
    private final ClassSessionRepository classSessionRepository;
    private final RoomRepository roomRepository;
    private final SeatReservationRepository seatReservationRepository;
    private final JdbcTemplate jdbc;

    public ClassSessionService(BookingRepository bookingRepository,
                               ClassSessionRepository classSessionRepository,
                               RoomRepository roomRepository,
                               SeatReservationRepository seatReservationRepository, JdbcTemplate jdbc) {
        this.bookingRepository = bookingRepository;
        this.classSessionRepository = classSessionRepository;
        this.roomRepository = roomRepository;
        this.seatReservationRepository = seatReservationRepository;
        this.jdbc = jdbc;
    }

    @Transactional
    public ClassSessionResponse create(ClassSessionRequest request) {
        Booking booking = bookingRepository.findByIdForUpdate(request.bookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found: " + request.bookingId()));
        if (!"PENDING".equals(booking.getStatus()) && !"CONFIRMED".equals(booking.getStatus())) {
            throw new IllegalArgumentException("Booking is not active: " + booking.getId());
        }
        var room = roomRepository.findById(booking.getRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("Room not found: " + booking.getRoomId()));
        if (!RoomCategory.matches(room, "CLASSROOM")) {
            throw new IllegalArgumentException("Class session requires a classroom booking");
        }
        if (classSessionRepository.findByBookingId(booking.getId()).isPresent()) {
            throw new ReservationConflictException("Booking already has a class session: " + booking.getId());
        }
        String code = request.courseCode().trim();
        String title = request.title().trim();
        if (code.length() > 30 || title.length() > 150) {
            throw new IllegalArgumentException("Course code or title is too long");
        }
        try {
            return toResponse(classSessionRepository.saveAndFlush(ClassSession.create(booking, code, title, Boolean.TRUE.equals(request.makeup()))));
        } catch (DataIntegrityViolationException ex) {
            if (DatabaseConflict.isConstraint(ex, "23505", "uq_class_sessions_booking")) {
                throw new ReservationConflictException("Booking already has a class session: " + booking.getId());
            }
            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public List<ClassSessionResponse> list() {
        return classSessionRepository.findAllByOrderByStartTimeAsc().stream()
                .filter(session -> bookingRepository.findById(session.getBookingId())
                        .map(booking -> "PENDING".equals(booking.getStatus()) || "CONFIRMED".equals(booking.getStatus())
                                || ("ABSENT".equals(calendarStatus(session.getId())) && "CANCELLED".equals(booking.getStatus())))
                        .orElse(false))
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<ClassSessionResponse> listByDate(LocalDate date) {
        return listBetween(date, date);
    }

    @Transactional(readOnly = true)
    public List<ClassSessionResponse> listBetween(LocalDate from, LocalDate to) {
        if (to.isBefore(from) || to.isAfter(from.plusDays(31))) {
            throw new IllegalArgumentException("Date range must be between 1 and 32 days");
        }
        var start = from.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toOffsetDateTime();
        var end = to.plusDays(1).atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toOffsetDateTime();
        return classSessionRepository.findActiveOnDate(start, end).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ClassSessionResponse getById(Long id) {
        return toResponse(classSessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Class session not found: " + id)));
    }

    @Transactional
    public ClassSessionResponse reportAbsence(Long id, Long teacherId) {
        return reportAbsence(id, teacherId, "Giảng viên báo vắng buổi học");
    }

    @Transactional
    public ClassSessionResponse reportAbsence(Long id, Long teacherId, String reason) {
        ClassSession session = classSessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Class session not found: " + id));
        jdbc.queryForObject("SELECT absence_request_id FROM request_teacher_absence(?, ?, ?)", Long.class,
                id, teacherId, reason);
        return toResponse(session);
    }

    @Transactional
    public ClassSessionResponse decideAbsence(Long id, Long adminId, boolean approve) {
        ClassSession session = classSessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Class session not found: " + id));
        List<Long> requests = jdbc.query("SELECT absence_request_id FROM absence_requests WHERE class_session_id=? AND request_type='TEACHER' AND status='PENDING' ORDER BY created_at DESC LIMIT 1",
                (rs, row) -> rs.getLong(1), id);
        if (requests.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Buổi học không có yêu cầu chờ duyệt.");
        jdbc.queryForObject("SELECT absence_request_id FROM review_teacher_absence(?, ?, ?, NULL)", Long.class,
                requests.getFirst(), adminId, approve);
        return toResponse(session);
    }

    private String calendarStatus(Long sessionId) {
        return jdbc.queryForObject("""
                SELECT CASE WHEN EXISTS (
                    SELECT 1 FROM absence_requests ar
                    WHERE ar.class_session_id=c.class_session_id
                      AND ar.request_type='TEACHER' AND ar.status='PENDING'
                ) THEN 'ABSENCE_PENDING' ELSE c.calendar_status END
                FROM class_session_calendar c WHERE c.class_session_id=?
                """,
                String.class, sessionId);
    }

    private ClassSessionResponse toResponse(ClassSession session) {
        return new ClassSessionResponse(session.getId(), session.getBookingId(),
                session.getCourseCode(), session.getTitle(), session.getRoomId(),
                session.getStartTime(), session.getEndTime(), session.getCreatedAt(), calendarStatus(session.getId()),
                bookingRepository.findById(session.getBookingId()).map(Booking::getUserId).orElse(null));
    }
}
