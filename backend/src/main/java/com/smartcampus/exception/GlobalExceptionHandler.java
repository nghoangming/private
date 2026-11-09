package com.smartcampus.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.dao.DataAccessException;
import java.sql.SQLException;
import jakarta.persistence.PessimisticLockException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ErrorResponse> handleDatabaseError(DataAccessException ex) {
        Throwable cause = ex.getMostSpecificCause();
        if (cause instanceof SQLException sql) {
            String state = sql.getSQLState();
            HttpStatus status = "42501".equals(state) ? HttpStatus.FORBIDDEN
                    : "23505".equals(state) || "23P01".equals(state) ? HttpStatus.CONFLICT
                    : "23514".equals(state) ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR;
            String message = status == HttpStatus.INTERNAL_SERVER_ERROR ? "Database request failed" : sql.getMessage();
            return ResponseEntity.status(status).body(new ErrorResponse(status.value(), message));
        }
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse(500, "Database request failed"));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatus(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode())
                .body(new ErrorResponse(ex.getStatusCode().value(),
                        ex.getReason() == null ? "Request failed" : ex.getReason()));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleResourceNotFound(ResourceNotFoundException ex) {
        return new ErrorResponse(
                404,
                ex.getMessage()
        );
    }

    @ExceptionHandler(ReservationConflictException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handleConflict(ReservationConflictException ex) {
        return new ErrorResponse(409, ex.getMessage());
    }

    @ExceptionHandler(SeatConflictException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handleSeatConflict(SeatConflictException ex) {
        return new ErrorResponse(409, ex.getMessage());
    }

    @ExceptionHandler({PessimisticLockException.class, CannotAcquireLockException.class})
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErrorResponse handleLockConflict(Exception ex) {
        return new ErrorResponse(409, "Resource is currently busy. Please retry.");
    }

    @ExceptionHandler({IllegalArgumentException.class, MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class, HttpMessageNotReadableException.class,
            MethodArgumentNotValidException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleBadRequest(Exception ex) {
        return new ErrorResponse(400, ex.getMessage() == null ? "Invalid request" : ex.getMessage());
    }
}
