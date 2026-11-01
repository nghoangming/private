package com.smartcampus.service;

import java.sql.SQLException;
import org.postgresql.util.PSQLException;

final class DatabaseConflict {
    private DatabaseConflict() { }

    static boolean isConstraint(Throwable error, String sqlState, String constraint) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof PSQLException postgresError
                    && sqlState.equals(postgresError.getSQLState())
                    && postgresError.getServerErrorMessage() != null
                    && constraint.equals(postgresError.getServerErrorMessage().getConstraint())) {
                return true;
            }
        }
        return false;
    }

    static boolean hasSqlState(Throwable error, String sqlState) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sqlError && sqlState.equals(sqlError.getSQLState())) {
                return true;
            }
        }
        return false;
    }
}
