package com.example.qsale;

import com.example.qsale.user.domain.Role;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.infrastructure.UserRepository;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.annotation.DirtiesContext;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@TestMethodOrder(OrderAnnotation.class)
class SchemaPersistenceIntegrationTest extends AbstractContainerBaseTest {

    private static final String EMAIL = "schema-persistence-" + UUID.randomUUID() + "@qsale.test";

    @Autowired
    private Environment environment;

    @Autowired
    private UserRepository userRepository;

    @Test
    @Order(1)
    @DirtiesContext(methodMode = DirtiesContext.MethodMode.AFTER_METHOD)
    void savesDataBeforeContextRestart() {
        assertEquals("update", environment.getProperty("spring.jpa.hibernate.ddl-auto"));
        userRepository.save(new User("Persistence check", EMAIL, "unused-hash", Role.USER));
        assertTrue(userRepository.existsByEmail(EMAIL));
    }

    @Test
    @Order(2)
    void retainsDataAfterContextRestart() {
        assertTrue(userRepository.existsByEmail(EMAIL));
        userRepository.findByEmail(EMAIL).ifPresent(userRepository::delete);
    }
}
