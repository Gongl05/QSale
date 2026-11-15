package com.example.qsale;

import com.example.qsale.notification.domain.EmailService;
import com.example.qsale.notification.domain.Notification;
import com.example.qsale.notification.domain.NotificationType;
import com.example.qsale.notification.infrastructure.NotificationRepository;
import com.example.qsale.user.infrastructure.UserRepository;
import com.example.qsale.location.domain.GeoService;
import com.example.qsale.location.domain.TravelEstimateSource;
import com.example.qsale.location.dto.TravelEstimateDto;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.CountDownLatch;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class FrontendContractIntegrationTest extends AbstractContainerBaseTest {
    @Autowired private MockMvc mvc;
    @Autowired private UserRepository users;
    @Autowired private NotificationRepository notifications;
    @MockitoBean private EmailService emailService;
    @MockitoSpyBean private GeoService geoService;

    @BeforeEach
    void preventExternalMail() {
        when(emailService.sendHtmlEmail(anyString(), anyString(), anyString(), anyMap())).thenReturn(true);
    }

    @Test
    void searchesAndSortsTheWholeOwnedDatasetBeforePagination() throws Exception {
        Account owner = account();
        Account outsider = account();
        plan(owner, "Cena Z");
        plan(owner, "Paseo");
        plan(owner, "Cena A");
        plan(outsider, "Cena ajena");

        mvc.perform(auth(get("/api/v1/plans").param("search", " CENA ").param("sort", "name,asc")
                        .param("page", "1").param("size", "1"), owner))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2)).andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.content[0].name").value("Cena Z"))
                .andExpect(jsonPath("$.content[0].currentUserRole").value("ORGANIZER"))
                .andExpect(jsonPath("$.content[0].currentUserParticipationStatus").value("JOINED"));
        mvc.perform(auth(get("/api/v1/plans").param("size", "100"), owner))
                .andExpect(status().isOk()).andExpect(jsonPath("$.size").value(100))
                .andExpect(jsonPath("$.totalElements").value(3));
        mvc.perform(auth(get("/api/v1/plans").param("search", "%"), owner))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void rejectsUnsupportedSortingAndInvalidPagination() throws Exception {
        Account owner = account();
        for (String sort : new String[]{"creator.password,asc", "name,sideways", "name", "name,asc,id"}) {
            mvc.perform(auth(get("/api/v1/plans").param("sort", sort), owner))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(auth(get("/api/v1/plans").param("search", "x".repeat(201)), owner))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(get("/api/v1/notifications/page").param("page", "-1"), owner))
                .andExpect(status().isBadRequest());
        mvc.perform(auth(get("/api/v1/notifications/page").param("size", "0"), owner))
                .andExpect(status().isBadRequest());
    }

    @Test
    void exposesPendingMembershipAndReflectsAcceptanceAfterReload() throws Exception {
        Account owner = account();
        Account guest = account();
        long plan = plan(owner, "Invitation");
        invite(owner, guest, plan);
        mvc.perform(auth(get("/api/v1/plans"), guest)).andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].currentUserRole").value("GUEST"))
                .andExpect(jsonPath("$.content[0].currentUserParticipationStatus").value("INVITED"));
        mvc.perform(auth(patch("/api/v1/plans/{id}/participants/me", plan), guest)).andExpect(status().isOk());
        mvc.perform(auth(get("/api/v1/plans/{id}", plan), guest)).andExpect(status().isOk())
                .andExpect(jsonPath("$.currentUserParticipationStatus").value("JOINED"));
    }

    @Test
    void paginatesOnlyTheRecipientsNotificationsAndReportsGlobalUnreadCount() throws Exception {
        Account recipient = account();
        Account other = account();
        for (int index = 0; index < 5; index++) {
            Notification notification = new Notification(users.findById(recipient.id()).orElseThrow(), null,
                    NotificationType.PLAN_UPDATED, "Message " + index);
            notification.setCreatedAt(LocalDateTime.of(2026, 1, 1, 12, index));
            if (index < 2) notification.setReadAt(LocalDateTime.now());
            notifications.save(notification);
        }
        notifications.save(new Notification(users.findById(other.id()).orElseThrow(), null,
                NotificationType.PLAN_UPDATED, "Private message"));

        mvc.perform(auth(get("/api/v1/notifications/page").param("page", "1").param("size", "2"), recipient))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(5))
                .andExpect(jsonPath("$.totalPages").value(3)).andExpect(jsonPath("$.unreadCount").value(3))
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].message").value("Message 2"));
        String filtered = mvc.perform(auth(get("/api/v1/notifications/page").param("unreadOnly", "true")
                        .param("size", "100"), recipient)).andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(100)).andExpect(jsonPath("$.totalElements").value(3))
                .andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(filtered, "$.content[0].id")).longValue();
        mvc.perform(auth(patch("/api/v1/notifications/{id}/read", id), other)).andExpect(status().isNotFound());
        mvc.perform(auth(patch("/api/v1/notifications/{id}/read", id), recipient)).andExpect(status().isOk());
        mvc.perform(auth(get("/api/v1/notifications/page").param("size", "1"), recipient))
                .andExpect(status().isOk()).andExpect(jsonPath("$.unreadCount").value(2));
        mvc.perform(auth(get("/api/v1/notifications"), recipient)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(5));
        mvc.perform(get("/api/v1/notifications/page")).andExpect(status().isUnauthorized());
    }

    @Test
    void persistsTheCurrentUsersVoteWithoutLeakingAnotherMembersSelection() throws Exception {
        Account owner = account();
        Account guest = account();
        long plan = plan(owner, "Votes");
        invite(owner, guest, plan);
        mvc.perform(auth(patch("/api/v1/plans/{id}/participants/me", plan), guest)).andExpect(status().isOk());
        String option = mvc.perform(auth(post("/api/v1/plans/{id}/options", plan), owner)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"DATE\",\"label\":\"Next week\",\"startsAt\":\"%s\"}"
                                .formatted(LocalDateTime.now().plusDays(5).withNano(0))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.estimateStatus").value("NOT_APPLICABLE"))
                .andReturn().getResponse().getContentAsString();
        long optionId = ((Number) JsonPath.read(option, "$.id")).longValue();
        mvc.perform(auth(post("/api/v1/options/{id}/votes", optionId), owner)).andExpect(status().isCreated());
        mvc.perform(auth(get("/api/v1/plans/{id}/options", plan), owner)).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].hasVoted").value(true));
        mvc.perform(auth(get("/api/v1/plans/{id}/options", plan), guest)).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].hasVoted").value(false)).andExpect(jsonPath("$[0].voteCount").value(1));
        mvc.perform(auth(delete("/api/v1/options/{id}/votes", optionId), owner)).andExpect(status().isNoContent());
        mvc.perform(auth(get("/api/v1/plans/{id}/options", plan), owner)).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].hasVoted").value(false));
    }

    @Test
    void distinguishesApproximateTravelFromMissingOrigins() throws Exception {
        Account owner = account();
        long plan = plan(owner, "Geography");
        mvc.perform(auth(post("/api/v1/plans/{id}/options", plan), owner).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"PLACE\",\"label\":\"Meeting\",\"location\":{\"latitude\":-12.15,\"longitude\":-77.02}}"))
                .andExpect(status().isCreated());
        String unavailable = awaitEstimate(plan, owner, "UNAVAILABLE");
        assertNull(JsonPath.read(unavailable, "$[0].estimateSource"));
        mvc.perform(auth(put("/api/v1/users/me"), owner).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Member\",\"location\":{\"latitude\":-12.12,\"longitude\":-77.03}}"))
                .andExpect(status().isOk());
        String ready = awaitEstimate(plan, owner, "READY");
        assertEquals("HAVERSINE", JsonPath.read(ready, "$[0].estimateSource"));
        assertNotNull(JsonPath.read(ready, "$[0].estimateUpdatedAt"));
        assertTrue(((Number) JsonPath.read(ready, "$[0].avgDistanceKm")).doubleValue() > 0);
    }

    private String awaitEstimate(long plan, Account owner, String status) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        do {
            String body = mvc.perform(auth(get("/api/v1/plans/{id}/options", plan), owner))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            if (status.equals(JsonPath.read(body, "$[0].estimateStatus"))) return body;
            Thread.sleep(25);
        } while (System.nanoTime() < deadline);
        throw new AssertionError("Estimate did not reach " + status);
    }

    @Test
    void invalidatesTheOldEstimateWhileNewCoordinatesAreBeingCalculated() throws Exception {
        Account owner = account();
        long plan = plan(owner, "Pending travel refresh");
        mvc.perform(auth(put("/api/v1/users/me"), owner).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Member\",\"location\":{\"latitude\":-12.12,\"longitude\":-77.03}}"))
                .andExpect(status().isOk());
        mvc.perform(auth(post("/api/v1/plans/{id}/options", plan), owner).contentType(MediaType.APPLICATION_JSON)
                .content("{\"type\":\"PLACE\",\"label\":\"Meeting point\",\"location\":{\"latitude\":-12.1,\"longitude\":-77.0}}"))
                .andExpect(status().isCreated());
        awaitEstimate(plan, owner, "READY");
        CountDownLatch started = new CountDownLatch(1), release = new CountDownLatch(1);
        doAnswer(invocation -> {
            started.countDown();
            if (!release.await(10, TimeUnit.SECONDS)) throw new AssertionError("Refresh not released");
            return new TravelEstimateDto(7.5, 20, TravelEstimateSource.HAVERSINE);
        }).when(geoService).estimateAverageTravel(anyList(), any());
        try {
            mvc.perform(auth(put("/api/v1/users/me"), owner).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Member\",\"location\":{\"latitude\":-12.2,\"longitude\":-77.1}}"))
                    .andExpect(status().isOk());
            assertTrue(started.await(5, TimeUnit.SECONDS));
            mvc.perform(auth(get("/api/v1/plans/{id}/options", plan), owner)).andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].estimateStatus").value("PENDING"))
                    .andExpect(jsonPath("$[0].avgDistanceKm").isEmpty());
        } finally { release.countDown(); }
        assertEquals(7.5, ((Number)JsonPath.read(awaitEstimate(plan, owner, "READY"), "$[0].avgDistanceKm")).doubleValue());
    }

    private Account account() throws Exception {
        String email = UUID.randomUUID() + "@qsale.test";
        String body = mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Member\",\"email\":\"%s\",\"password\":\"StrongPass1\"}".formatted(email)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return new Account(users.findByEmail(email).orElseThrow().getId(), email, JsonPath.read(body, "$.token"));
    }

    private long plan(Account owner, String name) throws Exception {
        String body = mvc.perform(auth(post("/api/v1/plans"), owner).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"%s\",\"type\":\"DINNER\",\"minParticipants\":2}".formatted(name)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    private void invite(Account owner, Account guest, long plan) throws Exception {
        mvc.perform(auth(post("/api/v1/plans/{id}/participants", plan), owner).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\"}".formatted(guest.email())))
                .andExpect(status().isCreated());
    }

    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request, Account account) {
        return request.header("Authorization", "Bearer " + account.token());
    }

    private record Account(Long id, String email, String token) { }
}
