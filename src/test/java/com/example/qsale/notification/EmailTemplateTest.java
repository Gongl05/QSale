package com.example.qsale.notification;

import org.junit.jupiter.api.Test;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EmailTemplateTest {

    private final TemplateEngine engine = engine();

    @Test
    void welcomeEmailShowsTheLogoThanksThePersonAndExplainsWhatToDoIfItWasNotThem() throws Exception {
        String html = render("email/welcome", Map.of(
                "name", "Gonzalo", "email", "gonzalo@correo.com",
                "logoUrl", "https://api.qsale.test/email/qsale-logo.png",
                "webUrl", "https://qsale.test", "supportAddress", "ayuda@qsale.test"));
        assertTrue(html.contains("src=\"https://api.qsale.test/email/qsale-logo.png\""));
        assertTrue(html.contains("Gracias por unirte a QSale"));
        assertTrue(html.contains("¡Hola, <span>Gonzalo</span>!"));
        assertTrue(html.contains("href=\"https://qsale.test\""));
        assertTrue(html.contains("mailto:ayuda@qsale.test"));
        // Leaves a preview to open in a browser when changing the design.
        Path preview = Path.of("target", "email-preview", "welcome.html");
        Files.createDirectories(preview.getParent());
        Files.writeString(preview, html);
    }

    @Test
    void welcomeEmailWorksWithoutOptionalLinks() {
        Map<String, Object> variables = new java.util.HashMap<>(Map.of(
                "name", "Ana", "email", "ana@correo.com", "logoUrl", "http://localhost:8080/email/qsale-logo.png"));
        variables.put("webUrl", null);
        variables.put("supportAddress", null);
        String html = render("email/welcome", variables);
        assertFalse(html.contains("Crear mi primer plan"));
        assertFalse(html.contains("mailto:"));
        assertTrue(html.contains("No necesitas hacer nada"));
    }

    @Test
    void everyEmailUsesTheSharedLogoHeader() {
        Map<String, Object> variables = Map.of("logoUrl", "https://api.qsale.test/email/qsale-logo.png",
                "planName", "Cena", "organizerName", "Ana", "inviteCode", "ABC123", "name", "Bob",
                "minParticipants", 2, "score", 80, "selectedDate", "Viernes", "selectedPlace", "Barranco",
                "budget", "S/ 60");
        for (String template : new String[]{"email/plan-invitation", "email/plan-ready", "email/plan-closed"}) {
            assertTrue(render(template, variables).contains("qsale-logo.png"), template);
        }
    }

    private String render(String template, Map<String, Object> variables) {
        Context context = new Context();
        context.setVariables(variables);
        return engine.process(template, context);
    }

    private static TemplateEngine engine() {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        resolver.setCharacterEncoding("UTF-8");
        TemplateEngine engine = new SpringTemplateEngine();
        engine.setTemplateResolver(resolver);
        return engine;
    }
}
