package com.example.qsale.auth;

import com.example.qsale.AbstractContainerBaseTest;
import com.example.qsale.auth.domain.PasswordRecoveryService;
import com.example.qsale.auth.infrastructure.PasswordResetRepository;
import com.example.qsale.notification.domain.EmailService;
import com.example.qsale.user.infrastructure.UserRepository;
import com.jayway.jsonpath.JsonPath;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.web-url=https://qsale.test")
@AutoConfigureMockMvc
class PasswordRecoveryIntegrationTest extends AbstractContainerBaseTest {
    @Autowired MockMvc mvc;
    @Autowired PasswordRecoveryService recovery;
    @Autowired PasswordResetRepository resets;
    @Autowired UserRepository users;
    @MockitoBean EmailService email;

    @Test void recoveredPasswordInvalidatesOldCredentialsAndSessionsAndTheLinkIsSingleUse() throws Exception {
        AtomicReference<String> link = new AtomicReference<>();
        when(email.sendHtmlEmail(anyString(),anyString(),anyString(),anyMap())).thenAnswer(call -> {
            if ("email/password-reset".equals(call.getArgument(2))) {
                Map<String,Object> variables = call.getArgument(3);
                link.set((String)variables.get("actionUrl"));
            }
            return true;
        });
        String address=UUID.randomUUID()+"@qsale.test";
        String signup=mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Recovery Test\",\"email\":\""+address+"\",\"password\":\"Original2026\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String access=JsonPath.read(signup,"$.token");
        String known=mvc.perform(post("/api/v1/auth/password-reset/request").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\""+address+"\"}"))
                .andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        String missing=mvc.perform(post("/api/v1/auth/password-reset/request").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\""+UUID.randomUUID()+"@missing.test\"}"))
                .andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        assertEquals(known,missing);
        recovery.deliverRequest(address);
        assertNotNull(link.get());
        assertTrue(link.get().startsWith("https://qsale.test/reset-password?token="));
        String token=link.get().substring(link.get().indexOf("token=")+6);
        var row=resets.findById(users.findByEmail(address).orElseThrow().getId()).orElseThrow();
        assertNotEquals(token,row.getTokenHash());assertEquals(64,row.getTokenHash().length());
        mvc.perform(post("/api/v1/auth/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\""+token+"\",\"password\":\"weak\"}"))
                .andExpect(status().isBadRequest());
        String confirmation="{\"token\":\""+token+"\",\"password\":\"ChangedPassword2026\"}";
        mvc.perform(post("/api/v1/auth/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .content(confirmation)).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/users/me").header("Authorization","Bearer "+access)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/signin").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\""+address+"\",\"password\":\"Original2026\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/signin").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\""+address+"\",\"password\":\"ChangedPassword2026\"}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/auth/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .content(confirmation)).andExpect(status().isBadRequest());
    }
}
