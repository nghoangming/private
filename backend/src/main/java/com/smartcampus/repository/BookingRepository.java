package com.smartcampus.repository;

import com.smartcampus.entity.Booking;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from Booking b where b.id = :id")
    Optional<Booking> findByIdForUpdate(@Param("id") Long id);

    /**
     * Overlap rule: existing.startTime < requested.endTime AND existing.endTime > requested.startTime.
     * Excludes cancelled / rejected bookings from conflict check.
     */
    @Query("""
            select b from Booking b
            where b.roomId = :roomId
              and upper(b.status) not in ('CANCELLED', 'CANCELED', 'REJECTED')
              and b.startTime < :endTime
              and b.endTime > :startTime
            order by b.startTime
            """)
    List<Booking> findOverlappingBookings(
            @Param("roomId") Long roomId,
            @Param("startTime") OffsetDateTime startTime,
            @Param("endTime") OffsetDateTime endTime);

    /**
     * List all bookings, ordered by creation time descending.
     */
    List<Booking> findAllByOrderByCreatedAtDesc();

    List<Booking> findByRoomIdInOrderByCreatedAtDesc(List<Long> roomIds);


    /**
     * List bookings filtered by status.
     */
    List<Booking> findByStatusOrderByCreatedAtDesc(String status);
}
