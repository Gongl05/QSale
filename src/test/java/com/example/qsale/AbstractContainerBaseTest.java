package com.example.qsale;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
public abstract class AbstractContainerBaseTest {

    static final PostgreSQLContainer<?> postgresqlContainer;

    static {
        postgresqlContainer = new PostgreSQLContainer<>("postgres:16-alpine")
                .withDatabaseName("qsale-test-db")
                .withUsername("postgres")
                .withPassword("postgres");

        postgresqlContainer.start();
    }

    @DynamicPropertySource
    static void overrideTestProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgresqlContainer::getJdbcUrl);
        registry.add("spring.datasource.username", postgresqlContainer::getUsername);
        registry.add("spring.datasource.password", postgresqlContainer::getPassword);
        registry.add("spring.datasource.driver-class-name", postgresqlContainer::getDriverClassName);
        registry.add("jwt.secret", () -> "test-secret-key-used-only-by-the-automated-tests-0123456789");
        registry.add("spring.jpa.show-sql", () -> "false");
    }
}
