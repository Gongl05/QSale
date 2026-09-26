package com.example.qsale;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
		"jwt.secret=test-secret-key-for-context-loading-only-0123456789",
		"spring.datasource.url=jdbc:h2:mem:qsale;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
		"spring.datasource.driver-class-name=org.h2.Driver",
		"spring.datasource.username=sa",
		"spring.datasource.password=",
		"spring.jpa.hibernate.ddl-auto=create-drop",
		"spring.sql.init.mode=never"
})
class QsaleApplicationTests {

	@Test
	void contextLoads() {
	}

}
