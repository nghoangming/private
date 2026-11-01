# Week 4 backend integration

The implementation lives in `src/main/java/com/smartcampus/`; no files from the
separate `week4` staging folder need to be copied over. Apply database migrations
005 and 006 before starting the backend (`ddl-auto=validate` does not run them).

## API sequence

1. Create a classroom reservation: `POST /api/v1/classroom-reservations` with
   `roomId`, `startTime`, and `endTime`. Study rooms use
   `POST /api/v1/study-room-reservations`.
2. Create its session: `POST /api/v1/class-sessions` with `bookingId`,
   `courseCode`, and `title`. The room and time come from the booking.
3. List seats: `GET /api/v1/class-sessions/{id}/seats`.
4. Reserve: `POST /api/v1/seat-reservations` with `classSessionId` and `seatId`.
   Details and cancellation use `GET /api/v1/seat-reservations/{id}` and
   `PATCH /api/v1/seat-reservations/{id}/cancel`.

The service locks the room before checking booking overlap, and locks the booking
and seat before checking seat availability. PostgreSQL exclusion/unique constraints
remain the final arbiter of simultaneous writes. A known room exclusion violation
or either active seat unique violation returns HTTP 409. Cancelling a booking also
cancels active seat selections for its class session in the same transaction.

Authentication is not implemented yet. Both room and seat reservations currently
use the placeholder `user_id = 1`; that user must exist. Replace the placeholder
with the authenticated user before using the API for multiple students. A real
PostgreSQL integration test with two concurrent transactions is still required
to verify deployment-specific lock behavior; the unit tests cover conflict
translation and business checks.
