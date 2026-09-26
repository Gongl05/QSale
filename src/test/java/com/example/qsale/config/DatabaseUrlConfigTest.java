package com.example.qsale.config;

import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DatabaseUrlConfigTest {

    private final DatabaseUrlConfig config = new DatabaseUrlConfig();

    @Test
    void convertsRenderConnectionStringToJdbcProperties() {
        try (HikariDataSource dataSource = config.databaseUrlDataSource(
                "postgresql://qsale:pass%40word@db.internal:5432/qsale")) {
            assertEquals("jdbc:postgresql://db.internal:5432/qsale", dataSource.getJdbcUrl());
            assertEquals("qsale", dataSource.getUsername());
            assertEquals("pass@word", dataSource.getPassword());
        }
    }

    @Test
    void rejectsInvalidConnectionString() {
        assertThrows(IllegalArgumentException.class,
                () -> config.databaseUrlDataSource("https://db.internal/qsale"));
    }
}
