package com.smartcampus.repository;

import com.smartcampus.entity.ClassSession;
import java.util.Optional;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClassSessionRepository extends JpaRepository<ClassSession, Long> {
    Optional<ClassSession> findByBookingId(Long bookingId);
    List<ClassSession> findAllByOrderByStartTimeAsc();
}
