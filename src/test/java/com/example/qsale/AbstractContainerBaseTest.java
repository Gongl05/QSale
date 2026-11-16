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
        String jobScope=java.util.UUID.randomUUID().toString();
        registry.add("jobs.scope",()->jobScope);
        registry.add("security.scope",()->jobScope);
        registry.add("security.rate-limit.api-limit",()->10000);
        registry.add("security.rate-limit.auth-limit",()->10000);
        registry.add("spring.datasource.url", postgresqlContainer::getJdbcUrl);
        registry.add("spring.datasource.username", postgresqlContainer::getUsername);
        registry.add("spring.datasource.password", postgresqlContainer::getPassword);
        registry.add("spring.datasource.driver-class-name", postgresqlContainer::getDriverClassName);
        registry.add("jwt.secret", () -> "test-secret-key-used-only-by-the-automated-tests-0123456789");
        registry.add("spring.jpa.show-sql", () -> "false");
    }
}
