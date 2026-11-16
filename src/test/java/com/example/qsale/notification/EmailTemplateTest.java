package com.example.qsale.notification;

import com.example.qsale.notification.domain.PublicLinks;
import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;
import static org.junit.jupiter.api.Assertions.*;

class EmailTemplateTest {
    @Test void allTransactionalTemplatesRenderWithBrandAndAction() {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");resolver.setSuffix(".html");resolver.setTemplateMode("HTML");
        resolver.setCharacterEncoding("UTF-8");
        SpringTemplateEngine engine = new SpringTemplateEngine();engine.setTemplateResolver(resolver);
        Context context = new Context(Locale.forLanguageTag("es-PE"));
        context.setVariables(Map.of("name","Ana","email","ana@example.test","actionUrl","https://qsale.test/plans/12",
                "planName","Cena del viernes","organizerName","Ana","inviteCode","A1B2C3D4",
                "minParticipants",4,"score",85,"selectedDate","20 de noviembre","selectedPlace","Barranco"));
        context.setVariable("budget","S/ 45.00");
        context.setVariable("logoUrl","https://qsale.test/qsale.png");
        for (String template : new String[]{"welcome","plan-invitation","plan-ready","plan-closed","password-reset","password-changed"}) {
            String result = engine.process("email/"+template,context);
            assertTrue(result.contains("QSale"),template);
            assertTrue(result.contains("https://qsale.test/plans/12"),template);
            assertTrue(result.contains("#ff8224"),template);
            assertTrue(result.contains("https://qsale.test/qsale.png"),template);
            assertFalse(result.contains("#4f46e5"),template);
        }
    }

    @Test void publicLinksUseOnlyConfiguredOriginAndEncodeCodes() {
        PublicLinks links = new PublicLinks("https://qsale.test/");
        assertEquals("https://qsale.test/join/A1B2C3D4",links.invitation("A1B2C3D4"));
        assertEquals("https://qsale.test/plans/12",links.plan(12L));
        assertThrows(IllegalArgumentException.class,()->new PublicLinks("javascript:alert(1)"));
        assertThrows(IllegalArgumentException.class,()->new PublicLinks("https://qsale.test/?override=1"));
        assertThrows(IllegalArgumentException.class,()->new PublicLinks("http://qsale.test"));
    }
}
