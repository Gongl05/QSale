package com.example.qsale.notification.domain;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.Map;
import java.util.List;

@Service
public class EmailService {

    private final Logger logger = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;
    private final String from;
    private final String resendApiKey;
    private final RestClient resendRestClient;
    private final String publicUrl;
    private final String webUrl;
    private final String supportAddress;

    public EmailService(JavaMailSender mailSender, TemplateEngine templateEngine,
                        @Value("${mail.from}") String from,
                        @Value("${resend.api-key}") String resendApiKey,
                        @Qualifier("resendRestClient") RestClient resendRestClient,
                        @Value("${app.public-url}") String publicUrl,
                        @Value("${app.web-url}") String webUrl,
                        @Value("${mail.support-address}") String supportAddress) {
        this.mailSender = mailSender;
        this.templateEngine = templateEngine;
        this.from = from;
        this.resendApiKey = resendApiKey;
        this.resendRestClient = resendRestClient;
        this.publicUrl = publicUrl;
        this.webUrl = webUrl;
        this.supportAddress = supportAddress;
    }

    public boolean sendHtmlEmail(String to, String subject, String template, Map<String, Object> variables) {
        try {
            Context context = new Context();
            context.setVariables(variables);
            // Shared by every template: the logo header, the button to open QSale and the help address.
            context.setVariable("logoUrl", withoutTrailingSlash(publicUrl) + "/email/qsale-logo.png");
            context.setVariable("webUrl", webUrl == null || webUrl.isBlank() ? null : webUrl);
            context.setVariable("supportAddress",
                    supportAddress == null || supportAddress.isBlank() ? null : supportAddress);
            String html = templateEngine.process(template, context);
            if (resendApiKey != null && !resendApiKey.isBlank()) {
                sendWithResend(to, subject, html);
            } else {
                sendWithSmtp(to, subject, html);
            }
            logger.info("Email '{}' sent to {}", subject, to);
            return true;
        } catch (MessagingException | MailException | RestClientException e) {
            logger.error("Could not send email '{}' to {}: {}", subject, to, e.getMessage());
            return false;
        }
    }

    private String withoutTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    private void sendWithResend(String to, String subject, String html) {
        resendRestClient.post()
                .uri("/emails")
                .header("Authorization", "Bearer " + resendApiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("from", from, "to", List.of(to), "subject", subject, "html", html))
                .retrieve()
                .toBodilessEntity();
    }

    private void sendWithSmtp(String to, String subject, String html) throws MessagingException {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, "UTF-8");
        helper.setFrom(from);
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(html, true);
        mailSender.send(message);
    }
}
