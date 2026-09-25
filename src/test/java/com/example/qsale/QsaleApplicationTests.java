package com.example.qsale;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = "jwt.secret=test-secret-key-for-context-loading-only-0123456789")
class QsaleApplicationTests {

	@Test
	void contextLoads() {
	}

}
