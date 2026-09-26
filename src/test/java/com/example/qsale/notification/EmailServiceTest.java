package com.example.qsale.notification;

import com.example.qsale.notification.domain.EmailService;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.Map;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;

class EmailServiceTest {

    private final JavaMailSender mailSender = mock(JavaMailSender.class);
    private final TemplateEngine templateEngine = mock(TemplateEngine.class);

    @Test
    void sendsRenderedTemplateThroughResendWhenConfigured() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.resend.test");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(once(), requestTo("https://api.resend.test/emails"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer test-key"))
                .andExpect(jsonPath("$.from").value("QSale <onboarding@resend.dev>"))
                .andExpect(jsonPath("$.to[0]").value("user@example.com"))
                .andExpect(jsonPath("$.html").value("<p>Hi</p>"))
                .andRespond(withSuccess("{\"id\":\"test-id\"}", MediaType.APPLICATION_JSON));
        when(templateEngine.process(eq("email/welcome"), any(Context.class))).thenReturn("<p>Hi</p>");

        EmailService service = new EmailService(mailSender, templateEngine,
                "QSale <onboarding@resend.dev>", "test-key", builder.build());

        assertTrue(service.sendHtmlEmail("user@example.com", "Welcome", "email/welcome", Map.of()));
        server.verify();
    }

    @Test
    void returnsFailureWhenProviderRejectsEmail() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.resend.test");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.resend.test/emails")).andRespond(withServerError());
        when(templateEngine.process(eq("email/welcome"), any(Context.class))).thenReturn("<p>Hi</p>");
        EmailService service = new EmailService(mailSender, templateEngine,
                "QSale <onboarding@resend.dev>", "test-key", builder.build());

        assertFalse(service.sendHtmlEmail("user@example.com", "Welcome", "email/welcome", Map.of()));
        server.verify();
    }

    @Test
    void keepsSmtpForLocalDevelopment() {
        MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(message);
        when(templateEngine.process(eq("email/welcome"), any(Context.class))).thenReturn("<p>Hi</p>");
        EmailService service = new EmailService(mailSender, templateEngine,
                "QSale <onboarding@resend.dev>", "", RestClient.create());

        assertTrue(service.sendHtmlEmail("user@example.com", "Welcome", "email/welcome", Map.of()));
        verify(mailSender).send(message);
    }
}
