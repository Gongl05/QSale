package com.example.qsale;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "jwt.secret=test-secret-key-for-day-2-integration-0123456789",
        "spring.datasource.url=jdbc:h2:mem:qsale-day2;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never"
})
@AutoConfigureMockMvc
class Day2ApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void completesTheDayTwoPlanLifecycle() throws Exception {
        String organizerToken = signUp("Organizer", "organizer@qsale.test");
        String guestToken = signUp("Guest", "guest@qsale.test");

        long planId = createPlan(organizerToken);

        inviteAndJoin(planId, organizerToken, guestToken);
        assertParticipants(planId, organizerToken);

        long dateOptionId = createDateOption(planId, organizerToken);
        long placeOptionId = createPlaceOption(planId, guestToken);
        voteForBothOptions(dateOptionId, placeOptionId, organizerToken, guestToken);

        addAvailability(planId, organizerToken);
        addAvailability(planId, guestToken);
        confirmCommitment(planId, organizerToken);
        confirmCommitment(planId, guestToken);

        assertReadyAndClose(planId, organizerToken);
        assertProtectedAndInvalidRequests(planId, organizerToken);
    }

    private String signUp(String name, String email) throws Exception {
        String body = """
                {"name":"%s","email":"%s","password":"StrongPass1"}
                """.formatted(name, email);
        MvcResult result = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.token");
    }

    private long createPlan(String token) throws Exception {
        String body = """
                {
                  "name":"Weekend trip",
                  "description":"Day 2 integration flow",
                  "type":"TRIP",
                  "budget":250.0,
                  "minParticipants":2,
                  "tentativeStartDate":"%s",
                  "tentativeEndDate":"%s"
                }
                """.formatted(LocalDate.now().plusDays(5), LocalDate.now().plusDays(6));
        MvcResult result = mockMvc.perform(post("/api/v1/plans")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.creatorName").value("Organizer"))
                .andReturn();
        Number id = JsonPath.read(result.getResponse().getContentAsString(), "$.id");
        return id.longValue();
    }

    private void inviteAndJoin(long planId, String organizerToken, String guestToken) throws Exception {
        mockMvc.perform(post("/api/v1/plans/{planId}/participants", planId)
                        .header("Authorization", bearer(organizerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"guest@qsale.test\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("INVITED"));

        mockMvc.perform(patch("/api/v1/plans/{planId}/participants/me", planId)
                        .header("Authorization", bearer(guestToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("JOINED"));
    }

    private void assertParticipants(long planId, String token) throws Exception {
        mockMvc.perform(get("/api/v1/plans/{planId}/participants", planId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    private long createDateOption(long planId, String token) throws Exception {
        LocalDateTime startsAt = LocalDateTime.now().plusDays(5).withNano(0);
        String body = """
                {"type":"DATE","label":"Saturday morning","startsAt":"%s","endsAt":"%s"}
                """.formatted(startsAt, startsAt.plusHours(3));
        return createOption(planId, token, body);
    }

    private long createPlaceOption(long planId, String token) throws Exception {
        String body = """
                {
                  "type":"PLACE",
                  "label":"UTEC campus",
                  "location":{"latitude":-12.135,"longitude":-77.022,"address":"Barranco","district":"Barranco"}
                }
                """;
        return createOption(planId, token, body);
    }

    private long createOption(long planId, String token, String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/plans/{planId}/options", planId)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        Number id = JsonPath.read(result.getResponse().getContentAsString(), "$.id");
        return id.longValue();
    }

    private void voteForBothOptions(long dateOptionId, long placeOptionId,
                                    String organizerToken, String guestToken) throws Exception {
        vote(dateOptionId, organizerToken);
        vote(dateOptionId, guestToken);
        vote(placeOptionId, organizerToken);
        vote(placeOptionId, guestToken);

        mockMvc.perform(post("/api/v1/options/{optionId}/votes", dateOptionId)
                        .header("Authorization", bearer(guestToken)))
                .andExpect(status().isConflict());
    }

    private void vote(long optionId, String token) throws Exception {
        mockMvc.perform(post("/api/v1/options/{optionId}/votes", optionId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isCreated());
    }

    private void addAvailability(long planId, String token) throws Exception {
        String body = """
                {"availableDate":"%s","startTime":"09:00:00","endTime":"13:00:00"}
                """.formatted(LocalDate.now().plusDays(5));
        mockMvc.perform(post("/api/v1/plans/{planId}/availabilities", planId)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());
    }

    private void confirmCommitment(long planId, String token) throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/v1/plans/{planId}/commitments/me", planId)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CONFIRMED\",\"note\":\"Count me in\"}"))
                .andExpect(status().isOk());
    }

    private void assertReadyAndClose(long planId, String token) throws Exception {
        mockMvc.perform(get("/api/v1/plans/{planId}/feasibility", planId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").value(100))
                .andExpect(jsonPath("$.status").value("READY_TO_CLOSE"));

        mockMvc.perform(patch("/api/v1/plans/{planId}/close", planId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));
    }

    private void assertProtectedAndInvalidRequests(long planId, String token) throws Exception {
        mockMvc.perform(get("/api/v1/plans/{planId}", planId))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/plans?page=-1&size=10")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch("/api/v1/plans/{planId}/cancel", planId)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isConflict());

        mockMvc.perform(get("/api/v1/notifications")
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk());
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
