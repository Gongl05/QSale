package com.example.qsale;

import com.example.qsale.notification.domain.EmailService;
import com.example.qsale.option.infrastructure.PlanOptionRepository;
import com.example.qsale.plan.domain.FeasibilityStatus;
import com.example.qsale.plan.infrastructure.PlanRepository;
import com.example.qsale.user.domain.Role;
import com.example.qsale.user.infrastructure.UserRepository;
import com.example.qsale.user.domain.UserService;
import com.example.qsale.user.dto.RoleUpdateDto;
import com.example.qsale.participant.domain.ParticipantRole;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class BackendRegressionIntegrationTest extends AbstractContainerBaseTest {

    @Autowired private MockMvc mvc;
    @Autowired private PlanRepository plans;
    @Autowired private PlanOptionRepository options;
    @Autowired private UserRepository users;
    @Autowired private UserService userService;
    @Autowired private PlanParticipantRepository participants;
    @Autowired private PlatformTransactionManager transactionManager;
    @MockitoBean private EmailService emailService;

    @BeforeEach
    void stubDelivery() {
        when(emailService.sendHtmlEmail(anyString(), anyString(), anyString(), anyMap())).thenReturn(true);
    }

    @Test
    void invitedGuestMustAcceptBeforeContributing() throws Exception {
        Account owner = account();
        Account guest = account();
        long plan = plan(owner);
        invite(plan, owner, guest);
        long option = dateOption(plan, owner);

        mvc.perform(auth(get("/api/v1/plans/{id}", plan), guest)).andExpect(status().isOk());
        mvc.perform(auth(post("/api/v1/plans/{id}/options", plan), guest)
                .contentType(MediaType.APPLICATION_JSON).content(dateBody())).andExpect(status().isForbidden());
        mvc.perform(auth(post("/api/v1/options/{id}/votes", option), guest)).andExpect(status().isForbidden());
        mvc.perform(auth(post("/api/v1/plans/{id}/availabilities", plan), guest)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"availableDate\":\"%s\"}".formatted(LocalDate.now().plusDays(5))))
                .andExpect(status().isForbidden());
        mvc.perform(auth(put("/api/v1/plans/{id}/commitments/me", plan), guest)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"CONFIRMED\"}"))
                .andExpect(status().isForbidden());

        accept(plan, guest);
        dateOption(plan, guest);
        mvc.perform(auth(patch("/api/v1/plans/{id}/cancel", plan), guest)).andExpect(status().isForbidden());
        mvc.perform(auth(post("/api/v1/plans/{id}/participants", plan), guest)
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"%s\"}".formatted(owner.email())))
                .andExpect(status().isForbidden());
    }

    @Test
    void organizerOfAnotherPlanHasNoAuthorityOverThisPlan() throws Exception {
        Account owner = account();
        Account stranger = account();
        long plan = plan(owner);
        plan(stranger);
        for (String resource : new String[]{"", "/participants", "/options", "/availabilities",
                "/commitments", "/feasibility", "/geography"}) {
            mvc.perform(auth(get("/api/v1/plans/" + plan + resource), stranger))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(auth(delete("/api/v1/plans/{id}", plan), stranger)).andExpect(status().isForbidden());
        mvc.perform(auth(get("/api/v1/admin/users"), owner)).andExpect(status().isForbidden());
        mvc.perform(auth(patch("/api/v1/admin/users/{id}/role", owner.id()), owner)
                .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"ADMIN\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminRoleChangesTakeEffectWithPreviouslyIssuedAccessToken() throws Exception {
        Account admin = account();
        Account member = account();
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> users.findById(admin.id()).orElseThrow().setRole(Role.ADMIN));
        mvc.perform(auth(patch("/api/v1/admin/users/{id}/role", member.id()), admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"ADMIN\"}"))
                .andExpect(status().isOk());
        mvc.perform(auth(get("/api/v1/admin/users"), member)).andExpect(status().isOk());
        mvc.perform(auth(patch("/api/v1/admin/users/{id}/role", member.id()), admin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"USER\"}"))
                .andExpect(status().isOk());
        mvc.perform(auth(get("/api/v1/admin/users"), member)).andExpect(status().isForbidden());
        long plan = plan(member);
        mvc.perform(auth(patch("/api/v1/plans/{id}/participants/me", plan), admin))
                .andExpect(status().isForbidden());
    }

    @Test
    void creatingFirstPlaceOptionRecalculatesStoredFeasibility() throws Exception {
        Account owner = account();
        Account guest = account();
        long plan = plan(owner);
        invite(plan, owner, guest);
        accept(plan, guest);
        long option = dateOption(plan, owner);
        for (Account member : new Account[]{owner, guest}) {
            mvc.perform(auth(post("/api/v1/options/{id}/votes", option), member)).andExpect(status().isCreated());
            mvc.perform(auth(put("/api/v1/plans/{id}/commitments/me", plan), member)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"CONFIRMED\"}"))
                    .andExpect(status().isOk());
        }
        awaitScore(plan, 80);
        mvc.perform(auth(post("/api/v1/plans/{id}/options", plan), owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"type\":\"PLACE\",\"label\":\"Campus\",\"location\":{\"latitude\":-12.1,\"longitude\":-77.0}}"))
                .andExpect(status().isCreated());
        awaitScore(plan, 65);
        mvc.perform(auth(get("/api/v1/plans/{id}/feasibility", plan), owner))
                .andExpect(jsonPath("$.score").value(65)).andExpect(jsonPath("$.status").value("TO_BE_DEFINED"));
        mvc.perform(auth(patch("/api/v1/plans/{id}/close", plan), owner)).andExpect(status().isBadRequest());
    }

    @Test
    void planEditsDoNotOverwriteAnIndependentFeasibilityUpdate() throws Exception {
        long plan = plan(account());
        TransactionTemplate outer = new TransactionTemplate(transactionManager);
        TransactionTemplate independent = new TransactionTemplate(transactionManager);
        independent.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        outer.executeWithoutResult(status -> {
            var stale = plans.findById(plan).orElseThrow();
            independent.executeWithoutResult(inner -> {
                var latest = plans.findById(plan).orElseThrow();
                latest.setFeasibilityScore(65);
                latest.setFeasibilityStatus(FeasibilityStatus.TO_BE_DEFINED);
            });
            stale.setName("Updated plan name");
        });
        var saved = plans.findById(plan).orElseThrow();
        assertEquals("Updated plan name", saved.getName());
        assertEquals(65, saved.getFeasibilityScore());
        assertEquals(FeasibilityStatus.TO_BE_DEFINED, saved.getFeasibilityStatus());
    }

    @Test
    void selectingAnOptionDoesNotOverwriteAnIndependentTravelUpdate() throws Exception {
        Account owner = account();
        long option = dateOption(plan(owner), owner);
        TransactionTemplate outer = new TransactionTemplate(transactionManager);
        TransactionTemplate independent = new TransactionTemplate(transactionManager);
        independent.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        outer.executeWithoutResult(status -> {
            var stale = options.findById(option).orElseThrow();
            independent.executeWithoutResult(inner -> {
                var latest = options.findById(option).orElseThrow();
                latest.setAvgDistanceKm(3.25);
                latest.setAvgTravelMinutes(8);
            });
            stale.setSelected(true);
        });
        var saved = options.findById(option).orElseThrow();
        assertTrue(saved.isSelected());
        assertEquals(3.25, saved.getAvgDistanceKm());
        assertEquals(8, saved.getAvgTravelMinutes());
    }

    @Test
    void organizerAuthorityBelongsToOnePlanAndGuestCannotManageAnother() throws Exception {
        Account first = account();
        Account second = account();
        long ownPlan = plan(first);
        long otherPlan = plan(second);
        invite(otherPlan, second, first);
        accept(otherPlan, first);

        assertEquals(ParticipantRole.ORGANIZER,
                participants.findByPlanIdAndUserId(ownPlan, first.id()).orElseThrow().getRole());
        assertEquals(ParticipantRole.GUEST,
                participants.findByPlanIdAndUserId(otherPlan, first.id()).orElseThrow().getRole());
        mvc.perform(auth(put("/api/v1/plans/{id}", ownPlan), first).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Own plan edited\",\"type\":\"DINNER\",\"minParticipants\":2}"))
                .andExpect(status().isOk());
        mvc.perform(auth(put("/api/v1/plans/{id}", otherPlan), first).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Other plan edited\",\"type\":\"DINNER\",\"minParticipants\":2}"))
                .andExpect(status().isForbidden());
        mvc.perform(auth(patch("/api/v1/plans/{id}/close", otherPlan), first))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminOperationsAreProtectedWhenCallingServicesDirectly() throws Exception {
        Account member = account();
        var user = users.findById(member.id()).orElseThrow();
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        SecurityContextHolder.setContext(context);
        try {
            assertThrows(AccessDeniedException.class, () -> userService.getAllUsers());
            RoleUpdateDto dto = new RoleUpdateDto();
            dto.setRole(Role.ADMIN);
            assertThrows(AccessDeniedException.class, () -> userService.updateRole(member.id(), dto));
        } finally {
            SecurityContextHolder.clearContext();
        }
        assertEquals(Role.USER, users.findById(member.id()).orElseThrow().getRole());
    }

    @Test
    void missingResourcesKeepTheirNotFoundResponse() throws Exception {
        Account member = account();
        mvc.perform(auth(get("/api/v1/plans/{id}", Long.MAX_VALUE), member)).andExpect(status().isNotFound());
        mvc.perform(auth(post("/api/v1/options/{id}/votes", Long.MAX_VALUE), member)).andExpect(status().isNotFound());
    }

    @Test
    void deletedUserCannotAuthenticateOrRefreshOldTokens() throws Exception {
        Account member = account();
        String response = mvc.perform(post("/api/v1/auth/signin").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"password\":\"StrongPass1\"}".formatted(member.email())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String refresh = JsonPath.read(response, "$.refreshToken");
        users.deleteById(member.id());
        mvc.perform(auth(get("/api/v1/users/me"), member)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(refresh)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refreshTokensCannotBeUsedAsAccessTokensOrViceVersa() throws Exception {
        Account member = account();
        String response = mvc.perform(post("/api/v1/auth/signin").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"password\":\"StrongPass1\"}".formatted(member.email())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String refresh = JsonPath.read(response, "$.refreshToken");
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + refresh))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(member.token())))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"%s\"}".formatted(refresh)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void rejectsPasswordsExceedingBcryptByteLimitWithClientError() throws Exception {
        String password = "Aa1" + "\uD83D\uDE00".repeat(20);
        mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Byte limit\",\"email\":\"%s@qsale.test\",\"password\":\"%s\"}"
                        .formatted(UUID.randomUUID(), password)))
                .andExpect(status().isBadRequest());
    }

    private Account account() throws Exception {
        String email = UUID.randomUUID() + "@qsale.test";
        String body = mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Test member\",\"email\":\"%s\",\"password\":\"StrongPass1\"}".formatted(email)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return new Account(users.findByEmail(email).orElseThrow().getId(), email, JsonPath.read(body, "$.token"));
    }

    private long plan(Account owner) throws Exception {
        String response = mvc.perform(auth(post("/api/v1/plans"), owner).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Regression plan\",\"type\":\"TRIP\",\"minParticipants\":2}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(response, "$.id")).longValue();
    }

    private long dateOption(long plan, Account member) throws Exception {
        String response = mvc.perform(auth(post("/api/v1/plans/{id}/options", plan), member)
                .contentType(MediaType.APPLICATION_JSON).content(dateBody()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(response, "$.id")).longValue();
    }

    private String dateBody() {
        return "{\"type\":\"DATE\",\"label\":\"Next week\",\"startsAt\":\"%s\"}"
                .formatted(LocalDateTime.now().plusDays(5).withNano(0));
    }

    private void invite(long plan, Account owner, Account guest) throws Exception {
        mvc.perform(auth(post("/api/v1/plans/{id}/participants", plan), owner)
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"%s\"}".formatted(guest.email())))
                .andExpect(status().isCreated());
    }

    private void accept(long plan, Account guest) throws Exception {
        mvc.perform(auth(patch("/api/v1/plans/{id}/participants/me", plan), guest)).andExpect(status().isOk());
    }

    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request, Account account) {
        return request.header("Authorization", "Bearer " + account.token());
    }

    private void awaitScore(long plan, int score) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        do {
            if (plans.findById(plan).orElseThrow().getFeasibilityScore() == score) return;
            Thread.sleep(25);
        } while (System.nanoTime() < deadline);
        assertEquals(score, plans.findById(plan).orElseThrow().getFeasibilityScore());
    }

    private record Account(Long id, String email, String token) { }
}
