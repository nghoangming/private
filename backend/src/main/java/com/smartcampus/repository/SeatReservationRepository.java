package com.smartcampus.repository;

import com.smartcampus.entity.SeatReservation;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SeatReservationRepository extends JpaRepository<SeatReservation, Long> {
    boolean existsByClassSessionIdAndSeatIdAndStatus(Long classSessionId, Long seatId, String status);

    boolean existsByClassSessionIdAndUserIdAndStatus(Long classSessionId, Long userId, String status);
    List<SeatReservation> findByUserIdAndStatus(Long userId, String status);

    @Query("select r.seatId from SeatReservation r "
            + "where r.classSessionId = :classSessionId and r.status = 'CONFIRMED'")
    List<Long> findConfirmedSeatIds(@Param("classSessionId") Long classSessionId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from SeatReservation r where r.id = :id")
    Optional<SeatReservation> findByIdForUpdate(@Param("id") Long id);

    @Modifying
    @Query("update SeatReservation r set r.status = 'CANCELLED' "
            + "where r.classSessionId = :classSessionId and r.status = 'CONFIRMED'")
    int cancelActiveForSession(@Param("classSessionId") Long classSessionId);
}
