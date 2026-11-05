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
    @Query("select cs from ClassSession cs, Booking b where cs.bookingId = b.id and b.status in ('PENDING', 'CONFIRMED') and cs.startTime >= :start and cs.startTime < :end order by cs.startTime asc")
    List<ClassSession> findActiveOnDate(@Param("start") OffsetDateTime start, @Param("end") OffsetDateTime end);
}
