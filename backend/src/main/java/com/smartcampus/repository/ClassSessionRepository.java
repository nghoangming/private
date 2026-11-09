package com.smartcampus.repository;

import com.smartcampus.entity.ClassSession;
import java.util.Optional;
import java.util.List;
import java.time.OffsetDateTime;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClassSessionRepository extends JpaRepository<ClassSession, Long> {
    Optional<ClassSession> findByBookingId(Long bookingId);
    List<ClassSession> findAllByOrderByStartTimeAsc();
    @Query(value = "select cs.* from class_sessions cs join bookings b using (booking_id) where (b.status in ('PENDING','CONFIRMED') or (b.status='CANCELLED' and exists (select 1 from absence_requests ar where ar.class_session_id=cs.class_session_id and ar.request_type='TEACHER' and ar.status='APPROVED'))) and cs.start_time >= :start and cs.start_time < :end order by cs.start_time", nativeQuery = true)
    List<ClassSession> findActiveOnDate(@Param("start") OffsetDateTime start, @Param("end") OffsetDateTime end);
}
