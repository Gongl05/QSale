package com.example.qsale;

import com.example.qsale.availability.infrastructure.AvailabilityRepository;
import com.example.qsale.commitment.infrastructure.CommitmentResponseRepository;
import com.example.qsale.option.domain.PlanOption;
import com.example.qsale.option.infrastructure.PlanOptionRepository;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.user.infrastructure.UserRepository;
import com.example.qsale.vote.infrastructure.VoteRepository;
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
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class Day2ApiIntegrationTest extends AbstractContainerBaseTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PlanParticipantRepository participantRepository;

    @Autowired
    private VoteRepository voteRepository;

    @Autowired
    private AvailabilityRepository availabilityRepository;

    @Autowired
    private CommitmentResponseRepository commitmentRepository;

    @Autowired
    private PlanOptionRepository optionRepository;

    @Test
    void completesTheDayTwoPlanLifecycle() throws Exception {
        String organizerToken = signUp("Organizer", "organizer@qsale.test");
        String guestToken = signUp("Guest", "guest@qsale.test");

        long planId = createPlan(organizerToken);

        inviteAndJoin(planId, organizerToken, guestToken, "guest@qsale.test");
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

    @Test
    void removingParticipantClearsOnlyTheirActivityInThatPlan() throws Exception {
        String organizerToken = signUp("Organizer", "removal-organizer@qsale.test");
        String guestEmail = "removal-guest@qsale.test";
        String guestToken = signUp("Guest", guestEmail);
        Long organizerId = userRepository.findByEmail("removal-organizer@qsale.test").orElseThrow().getId();
        Long guestId = userRepository.findByEmail(guestEmail).orElseThrow().getId();

        long firstPlanId = createPlan(organizerToken);
        long secondPlanId = createPlan(organizerToken);
        inviteAndJoin(firstPlanId, organizerToken, guestToken, guestEmail);
        inviteAndJoin(secondPlanId, organizerToken, guestToken, guestEmail);

        long firstOptionId = createDateOption(firstPlanId, organizerToken);
        long secondOptionId = createDateOption(secondPlanId, organizerToken);
        vote(firstOptionId, guestToken);
        vote(secondOptionId, guestToken);
        addAvailability(firstPlanId, guestToken);
        addAvailability(secondPlanId, guestToken);
        confirmCommitment(firstPlanId, guestToken);
        confirmCommitment(secondPlanId, guestToken);

        mockMvc.perform(get("/api/v1/plans/{planId}/feasibility", firstPlanId)
                        .header("Authorization", bearer(organizerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").value(50))
                .andExpect(jsonPath("$.confirmedParticipants").value(1));

        mockMvc.perform(delete("/api/v1/plans/{planId}/participants/{userId}", firstPlanId, organizerId)
                        .header("Authorization", bearer(organizerToken)))
                .andExpect(status().isBadRequest());
        mockMvc.perform(delete("/api/v1/plans/{planId}/participants/{userId}", firstPlanId, organizerId)
                        .header("Authorization", bearer(guestToken)))
                .andExpect(status().isForbidden());
        assertTrue(voteRepository.existsByOptionIdAndUserId(firstOptionId, guestId));

        mockMvc.perform(delete("/api/v1/plans/{planId}/participants/{userId}", firstPlanId, guestId)
                        .header("Authorization", bearer(organizerToken)))
                .andExpect(status().isNoContent());

        assertFalse(participantRepository.existsByPlanIdAndUserId(firstPlanId, guestId));
        assertFalse(voteRepository.existsByOptionIdAndUserId(firstOptionId, guestId));
        assertTrue(availabilityRepository.findByPlanIdAndUserId(firstPlanId, guestId).isEmpty());
        assertTrue(commitmentRepository.findByPlanIdAndUserId(firstPlanId, guestId).isEmpty());

        mockMvc.perform(get("/api/v1/plans/{planId}/feasibility", firstPlanId)
                        .header("Authorization", bearer(organizerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").value(0))
                .andExpect(jsonPath("$.status").value("NOT_VIABLE"))
                .andExpect(jsonPath("$.confirmedParticipants").value(0))
                .andExpect(jsonPath("$.totalParticipants").value(1));

        mockMvc.perform(get("/api/v1/plans/{planId}", firstPlanId)
                        .header("Authorization", bearer(guestToken)))
                .andExpect(status().isForbidden());

        assertTrue(participantRepository.existsByPlanIdAndUserId(secondPlanId, guestId));
        assertTrue(voteRepository.existsByOptionIdAndUserId(secondOptionId, guestId));
        assertFalse(availabilityRepository.findByPlanIdAndUserId(secondPlanId, guestId).isEmpty());
        assertTrue(commitmentRepository.findByPlanIdAndUserId(secondPlanId, guestId).isPresent());

        mockMvc.perform(delete("/api/v1/plans/{planId}/participants/{userId}", secondPlanId, guestId)
                        .header("Authorization", bearer(guestToken)))
                .andExpect(status().isNoContent());

        assertFalse(participantRepository.existsByPlanIdAndUserId(secondPlanId, guestId));
        assertFalse(voteRepository.existsByOptionIdAndUserId(secondOptionId, guestId));
        assertTrue(availabilityRepository.findByPlanIdAndUserId(secondPlanId, guestId).isEmpty());
        assertTrue(commitmentRepository.findByPlanIdAndUserId(secondPlanId, guestId).isEmpty());
    }

    @Test
    void refreshesTravelEstimateAfterMembershipAndLocationChanges() throws Exception {
        String organizerToken = signUp("Organizer", "travel-organizer@qsale.test");
        String guestEmail = "travel-guest@qsale.test";
        String guestToken = signUp("Guest", guestEmail);
        Long guestId = userRepository.findByEmail(guestEmail).orElseThrow().getId();
        long firstPlanId = createPlan(organizerToken);
        long secondPlanId = createPlan(organizerToken);
        long firstOptionId = createPlaceOption(firstPlanId, organizerToken);
        long anotherOptionId = createPlaceOption(firstPlanId, organizerToken);
        long secondOptionId = createPlaceOption(secondPlanId, organizerToken);

        updateLocation(guestToken, -12.1211, -77.0297);
        inviteAndJoin(firstPlanId, organizerToken, guestToken, guestEmail);
        inviteAndJoin(secondPlanId, organizerToken, guestToken, guestEmail);
        Predicate<PlanOption> hasDistance = option -> option.getAvgDistanceKm() != null && option.getAvgDistanceKm() > 0;
        awaitOption(firstOptionId, hasDistance);
        awaitOption(anotherOptionId, hasDistance);
        awaitOption(secondOptionId, hasDistance);

        updateLocation(guestToken, -12.135, -77.022);
        Predicate<PlanOption> hasZeroDistance = option -> Double.valueOf(0).equals(option.getAvgDistanceKm())
                && Integer.valueOf(0).equals(option.getAvgTravelMinutes());
        awaitOption(firstOptionId, hasZeroDistance);
        awaitOption(anotherOptionId, hasZeroDistance);
        awaitOption(secondOptionId, hasZeroDistance);

        mockMvc.perform(delete("/api/v1/plans/{planId}/participants/{userId}", firstPlanId, guestId)
                        .header("Authorization", bearer(organizerToken)))
                .andExpect(status().isNoContent());
        Predicate<PlanOption> hasNoEstimate = option -> option.getAvgDistanceKm() == null
                && option.getAvgTravelMinutes() == null;
        awaitOption(firstOptionId, hasNoEstimate);
        awaitOption(anotherOptionId, hasNoEstimate);
        assertTrue(hasZeroDistance.test(optionRepository.findById(secondOptionId).orElseThrow()));

        mockMvc.perform(delete("/api/v1/plans/{planId}/participants/{userId}", secondPlanId, guestId)
                        .header("Authorization", bearer(guestToken)))
                .andExpect(status().isNoContent());
        awaitOption(secondOptionId, hasNoEstimate);
    }

    private void updateLocation(String token, double latitude, double longitude) throws Exception {
        String body = """
                {"name":"Guest","location":{"latitude":%s,"longitude":%s}}
                """.formatted(latitude, longitude);
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/v1/users/me")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());
    }

    private void awaitOption(long optionId, Predicate<PlanOption> condition) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        PlanOption option;
        do {
            option = optionRepository.findById(optionId).orElseThrow();
            if (condition.test(option)) {
                return;
            }
            Thread.sleep(50);
        } while (System.nanoTime() < deadline);
        assertTrue(condition.test(option), "Travel estimate did not refresh within five seconds");
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

    private void inviteAndJoin(long planId, String organizerToken, String guestToken, String guestEmail) throws Exception {
        mockMvc.perform(post("/api/v1/plans/{planId}/participants", planId)
                        .header("Authorization", bearer(organizerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\"}".formatted(guestEmail)))
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
