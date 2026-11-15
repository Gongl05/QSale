package com.example.qsale;

import com.example.qsale.notification.domain.EmailService;
import com.example.qsale.user.domain.Role;
import com.example.qsale.user.infrastructure.UserRepository;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.UUID;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class FlowAuditIntegrationTest extends AbstractContainerBaseTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @MockitoBean EmailService emailService;

    @BeforeEach void preventExternalMail() {
        when(emailService.sendHtmlEmail(anyString(), anyString(), anyString(), anyMap())).thenReturn(true);
    }

    @Test void statusOnlyCommitmentPreservesTheExistingNoteAndEmptyTextClearsIt() throws Exception {
        Account owner = account();
        long plan = plan(owner);
        mvc.perform(auth(put("/api/v1/plans/{id}/commitments/me", plan), owner)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"CONFIRMED\",\"note\":\"After class\"}"))
                .andExpect(status().isOk());
        mvc.perform(auth(put("/api/v1/plans/{id}/commitments/me", plan), owner)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"INTERESTED\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.note").value("After class"));
        mvc.perform(auth(put("/api/v1/plans/{id}/commitments/me", plan), owner)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"CONFIRMED\",\"note\":\"\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.note").value(""));
    }

    @Test void rejectsAvailabilityWithOnlyOneHour() throws Exception {
        Account owner = account();
        long plan = plan(owner);
        for (String hours : new String[]{"\"startTime\":\"09:00\"", "\"endTime\":\"12:00\""})
            mvc.perform(auth(post("/api/v1/plans/{id}/availabilities", plan), owner)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"availableDate\":\"%s\",%s}".formatted(LocalDate.now().plusDays(2), hours)))
                    .andExpect(status().isBadRequest());
        mvc.perform(auth(get("/api/v1/plans/{id}/availabilities", plan), owner))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test void explicitlyRemovesASavedProfileLocation() throws Exception {
        Account owner = account();
        mvc.perform(auth(put("/api/v1/users/me"), owner).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Member\",\"location\":{\"latitude\":-12.1,\"longitude\":-77.0}}"))
                .andExpect(status().isOk());
        mvc.perform(auth(put("/api/v1/users/me"), owner).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Member\",\"removeLocation\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.location").isEmpty());
        mvc.perform(auth(get("/api/v1/users/me"), owner)).andExpect(status().isOk())
                .andExpect(jsonPath("$.location").isEmpty());
    }

    @Test void reopeningAnInvitationReachesTheExistingMembership() throws Exception {
        Account owner = account(), guest = account();
        long plan = plan(owner);
        String body = mvc.perform(auth(get("/api/v1/plans/{id}", plan), owner))
                .andReturn().getResponse().getContentAsString();
        String code = JsonPath.read(body, "$.inviteCode");
        for (int i = 0; i < 2; i++)
            mvc.perform(auth(post("/api/v1/plans/join/{code}", code), guest))
                    .andExpect(status().isCreated()).andExpect(jsonPath("$.planId").value(plan));
        mvc.perform(auth(get("/api/v1/plans/{id}/participants", plan), owner))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
        mvc.perform(auth(patch("/api/v1/plans/{id}/cancel", plan), owner)).andExpect(status().isOk());
        mvc.perform(auth(post("/api/v1/plans/join/{code}", code), guest)).andExpect(status().isCreated());
        mvc.perform(auth(post("/api/v1/plans/join/{code}", code), account())).andExpect(status().is4xxClientError());
    }

    @Test void preventsRemovingTheLastAdministrator() throws Exception {
        Account admin = account();
        users.findAll().forEach(user -> user.setRole(Role.USER));
        var user = users.findById(admin.id()).orElseThrow();
        user.setRole(Role.ADMIN);
        users.flush();
        mvc.perform(auth(patch("/api/v1/admin/users/{id}/role", admin.id()), admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"USER\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(get("/api/v1/admin/users"), admin)).andExpect(status().isOk());
    }

    private Account account() throws Exception {
        String email = UUID.randomUUID() + "@qsale.test";
        String body = mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Member\",\"email\":\"%s\",\"password\":\"StrongPass1\"}".formatted(email)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return new Account(users.findByEmail(email).orElseThrow().getId(), JsonPath.read(body, "$.token"));
    }
    private long plan(Account owner) throws Exception {
        String body = mvc.perform(auth(post("/api/v1/plans"), owner).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Flow audit\",\"type\":\"OTHER\",\"minParticipants\":2}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number)JsonPath.read(body, "$.id")).longValue();
    }
    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request, Account account) {
        return request.header("Authorization", "Bearer " + account.token());
    }
    private record Account(Long id, String token) { }
}
