package com.example.qsale;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.qsale.notification.domain.EmailService;
import com.example.qsale.reschedule.infrastructure.RescheduleRepository;
import com.jayway.jsonpath.JsonPath;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
class CoordinationFlowIntegrationTest extends AbstractContainerBaseTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    RescheduleRepository proposals;

    @Autowired
    com.example.qsale.option.infrastructure.PlanOptionRepository optionRepository;

    @Autowired
    com.example.qsale.notification.domain.NotificationService notifications;

    @Autowired
    com.example.qsale.jobs.BackgroundJobRepository backgroundJobs;

    @MockitoBean
    EmailService emailService;

    private final LocalDate day = LocalDate.now(ZoneId.of("America/Lima")).plusDays(10);

    @BeforeEach
    void preventExternalMail() {
        when(emailService.sendHtmlEmail(anyString(), anyString(), anyString(), anyMap())).thenReturn(true);
    }

    @Test
    void closesOnlyWithAVotedDayAndPlaceAndDoesNotInventATime() throws Exception {
        Fixture f = open(2);
        long date = createOption(
            f,
            "{\"type\":\"DATE\",\"label\":\"Solo un día\",\"startsOn\":\"%s\"}".formatted(day)
        );
        for (Account user : f.members()) {
            voteOption(user, date);
            respond(user, f.id(), "CONFIRMED");
        }
        mvc.perform(auth(get("/api/v1/plans/{id}/feasibility", f.id()), f.owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.dateReady").value(true))
            .andExpect(jsonPath("$.placeReady").value(false));
        mvc.perform(auth(patch("/api/v1/plans/{id}/close", f.id()), f.owner())).andExpect(
            status().isBadRequest()
        );
        long place = createOption(f, placeInput());
        for (Account user : f.members()) voteOption(user, place);
        mvc.perform(auth(patch("/api/v1/plans/{id}/close", f.id()), f.owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.agreementVersion").value(1))
            .andExpect(jsonPath("$.tentativeStartDate").value(day.toString()));
        String result = body(auth(get("/api/v1/plans/{id}/options", f.id()), f.owner()), 200);
        assertEquals(2, ((List<?>) JsonPath.read(result, "$[?(@.selected == true)]")).size());
        assertEquals(
            day.toString(),
            ((java.util.List<?>) JsonPath.read(result, "$[?(@.type == 'DATE')].startsOn")).getFirst()
        );
        assertNull(((List<?>) JsonPath.read(result, "$[?(@.type == 'DATE')].startsAt")).getFirst());
    }

    @Test
    void lateWithdrawalsPreserveTheAgreementAndOtherConfirmationsAndNotifyOnce() throws Exception {
        Fixture f = closed(3);
        respond(f.members().get(1), f.id(), "CANT_GO");
        respond(f.members().get(2), f.id(), "CANT_GO");
        respond(f.members().get(2), f.id(), "CANT_GO");
        mvc.perform(auth(get("/api/v1/plans/{id}", f.id()), f.owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CLOSED"))
            .andExpect(jsonPath("$.agreementVersion").value(1));
        String commitments = body(auth(get("/api/v1/plans/{id}/commitments", f.id()), f.owner()), 200);
        assertEquals(1, ((List<?>) JsonPath.read(commitments, "$[?(@.status == 'CONFIRMED')]")).size());
        String notices = body(auth(get("/api/v1/notifications"), f.owner()), 200);
        assertEquals(
            1,
            ((List<?>) JsonPath.read(notices, "$[?(@.type == 'ATTENDANCE_BELOW_MINIMUM')]")).size()
        );
        assertEquals(
            2,
            (
                (List<?>) JsonPath.read(
                    body(auth(get("/api/v1/plans/{id}/options", f.id()), f.owner()), 200),
                    "$[?(@.selected == true)]"
                )
            ).size()
        );
    }

    @Test
    void profileLocationChangesRefreshTravelEstimatesAfterThePlanIsConfirmed() throws Exception {
        Fixture f = closed(2);
        mvc.perform(auth(put("/api/v1/users/me"), f.owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Organizer\",\"location\":{\"latitude\":-12.1,\"longitude\":-77.0}}"))
            .andExpect(status().isOk());
        awaitPlaceEstimate(f, "READY");
        mvc.perform(auth(put("/api/v1/users/me"), f.owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Organizer\",\"removeLocation\":true}"))
            .andExpect(status().isOk());
        awaitPlaceEstimate(f, "UNAVAILABLE");
        mvc.perform(auth(get("/api/v1/plans/{id}", f.id()), f.owner()))
            .andExpect(jsonPath("$.status").value("CLOSED"))
            .andExpect(jsonPath("$.agreementVersion").value(1));
    }

    private void awaitPlaceEstimate(Fixture f, String expected) throws Exception {
        for (int attempt = 0; attempt < 150; attempt++) {
            String result = body(auth(get("/api/v1/plans/{id}/options", f.id()), f.owner()), 200);
            List<String> states = JsonPath.read(result, "$[?(@.type == 'PLACE')].estimateStatus");
            if (!states.isEmpty() && states.stream().allMatch(expected::equals)) return;
            Thread.sleep(100);
        }
        String jobs = backgroundJobs.findAll().stream()
                .filter(job -> job.getType().startsWith("TRAVEL"))
                .map(job -> job.getType() + ":" + job.getStatus() + ":" + job.getAttempts() + ":" + job.getLastError())
                .collect(java.util.stream.Collectors.joining(", "));
        fail("Travel estimates did not become " + expected + " after changing the profile location. Jobs: " + jobs);
    }

    @Test
    void aRejectedProposalDoesNotChangeTheEventOrItsAttendance() throws Exception {
        Fixture f = closed(3);
        long proposal = propose(f);
        ballot(f, f.members().get(1), proposal, false);
        String result = ballot(f, f.members().get(2), proposal, false);
        assertEquals("REJECTED", JsonPath.read(result, "$.status"));
        mvc.perform(auth(get("/api/v1/plans/{id}", f.id()), f.owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tentativeStartDate").value(day.toString()))
            .andExpect(jsonPath("$.agreementVersion").value(1));
        String commitments = body(auth(get("/api/v1/plans/{id}/commitments", f.id()), f.owner()), 200);
        assertEquals(3, ((List<?>) JsonPath.read(commitments, "$[?(@.status == 'CONFIRMED')]")).size());
        mvc.perform(
            auth(put("/api/v1/plans/{p}/reschedules/{r}/vote", f.id(), proposal), f.owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"accepted\":true}")
        ).andExpect(status().isConflict());
    }

    @Test
    void onlyTheOrganizerAppliesAndYesVotesBecomeConfirmationsWithoutASecondQuestion() throws Exception {
        Fixture f = closed(3);
        long proposal = propose(f);
        assertEquals("APPROVED", JsonPath.read(ballot(f, f.members().get(1), proposal, true), "$.status"));
        mvc.perform(
            auth(patch("/api/v1/plans/{p}/reschedules/{r}/apply", f.id(), proposal), f.members().get(1))
        ).andExpect(status().isForbidden());
        mvc.perform(auth(patch("/api/v1/plans/{p}/reschedules/{r}/apply", f.id(), proposal), f.owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("APPLIED"));
        mvc.perform(auth(get("/api/v1/plans/{id}", f.id()), f.owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CLOSED"))
            .andExpect(jsonPath("$.agreementVersion").value(2))
            .andExpect(jsonPath("$.tentativeStartDate").value(day.plusDays(1).toString()));
        String commitments = body(auth(get("/api/v1/plans/{id}/commitments", f.id()), f.owner()), 200);
        assertEquals(2, ((List<?>) JsonPath.read(commitments, "$[?(@.status == 'CONFIRMED')]")).size());
        assertEquals(1, ((List<?>) JsonPath.read(commitments, "$[?(@.status == 'INTERESTED')]")).size());
        respond(f.members().get(1), f.id(), "CANT_GO");
        mvc.perform(auth(get("/api/v1/plans/{id}", f.id()), f.owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.agreementVersion").value(2));
        mvc.perform(
            auth(patch("/api/v1/plans/{p}/reschedules/{r}/apply", f.id(), proposal), f.owner())
        ).andExpect(status().is4xxClientError());
    }

    @Test
    void canProposeAndApplyANewPlaceAndAnOptionalTime() throws Exception {
        Fixture f = closed(2);
        String created = body(
            auth(post("/api/v1/plans/{id}/reschedules", f.id()), f.owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"date\":\"%s\",\"time\":\"18:30\",\"placeLabel\":\"Otro parque\",\"location\":{\"latitude\":-12.2,\"longitude\":-77.1}}".formatted(
                        day.plusDays(2)
                    )
                ),
            201
        );
        long proposal = id(created);
        ballot(f, f.members().get(1), proposal, true);
        mvc.perform(
            auth(patch("/api/v1/plans/{p}/reschedules/{r}/apply", f.id(), proposal), f.owner())
        ).andExpect(status().isOk());
        String choices = body(auth(get("/api/v1/plans/{id}/options", f.id()), f.owner()), 200);
        assertEquals(
            "Otro parque",
            (
                (List<?>) JsonPath.read(choices, "$[?(@.selected == true && @.type == 'PLACE')].label")
            ).getFirst()
        );
        assertTrue(
            (
                (String) (
                    (List<?>) JsonPath.read(choices, "$[?(@.selected == true && @.type == 'DATE')].startsAt")
                ).getFirst()
            ).endsWith("18:30:00")
        );
    }

    @Test
    void foreignPlansOutsidersAndExpiredOrWithdrawnProposalsCannotBeUsed() throws Exception {
        Fixture f = closed(3);
        long proposal = propose(f);
        Account outsider = account();
        mvc.perform(auth(get("/api/v1/plans/{id}/reschedules", f.id()), outsider)).andExpect(
            status().isForbidden()
        );
        Fixture other = open(2);
        mvc.perform(
            auth(put("/api/v1/plans/{p}/reschedules/{r}/vote", other.id(), proposal), other.owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"accepted\":true}")
        ).andExpect(status().isNotFound());
        mvc.perform(
            auth(patch("/api/v1/plans/{p}/reschedules/{r}/withdraw", f.id(), proposal), f.members().get(1))
        ).andExpect(status().isForbidden());
        var row = proposals.findById(proposal).orElseThrow();
        row.setExpiresAt(Instant.now().minusSeconds(1));
        proposals.saveAndFlush(row);
        String list = body(auth(get("/api/v1/plans/{id}/reschedules", f.id()), f.owner()), 200);
        assertEquals("EXPIRED", JsonPath.read(list, "$[0].status"));
        mvc.perform(
            auth(put("/api/v1/plans/{p}/reschedules/{r}/vote", f.id(), proposal), f.owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"accepted\":true}")
        ).andExpect(status().isConflict());
        long second = propose(f);
        mvc.perform(auth(patch("/api/v1/plans/{p}/reschedules/{r}/withdraw", f.id(), second), f.owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("WITHDRAWN"));
    }

    @Test
    void reopeningIsExplicitAndOnlyThenRequestsNewConfirmations() throws Exception {
        Fixture f = closed(2);
        long proposal = propose(f);
        mvc.perform(auth(patch("/api/v1/plans/{id}/reopen", f.id()), f.members().get(1))).andExpect(
            status().isForbidden()
        );
        mvc.perform(auth(patch("/api/v1/plans/{id}/reopen", f.id()), f.owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("OPEN"));
        String commitments = body(auth(get("/api/v1/plans/{id}/commitments", f.id()), f.owner()), 200);
        assertEquals(0, ((List<?>) JsonPath.read(commitments, "$[?(@.status == 'CONFIRMED')]")).size());
        assertEquals(
            "SUPERSEDED",
            JsonPath.read(
                body(auth(get("/api/v1/plans/{id}/reschedules", f.id()), f.owner()), 200),
                "$[0].status"
            )
        );
        mvc.perform(auth(patch("/api/v1/plans/{id}/close", f.id()), f.owner())).andExpect(
            status().isBadRequest()
        );
    }

    @Test
    void availabilityRecommendationsDistinguishUnknownDataAndIncompatibleTimes() throws Exception {
        Fixture f = open(3);
        availability(f.owner(), f.id(), "09:00", "12:00");
        availability(f.members().get(1), f.id(), "10:00", "13:00");
        String partial = body(auth(get("/api/v1/plans/{id}/date-recommendations", f.id()), f.owner()), 200);
        assertEquals(1, ((Number) JsonPath.read(partial, "$[0].unknownParticipants")).intValue());
        assertEquals(false, JsonPath.read(partial, "$[0].allParticipantsAvailable"));
        assertEquals("10:00:00", JsonPath.read(partial, "$[0].commonStartTime"));
        availability(f.members().get(2), f.id(), "14:00", "15:00");
        String mismatch = body(auth(get("/api/v1/plans/{id}/date-recommendations", f.id()), f.owner()), 200);
        assertEquals(true, JsonPath.read(mismatch, "$[0].allParticipantsAvailable"));
        assertEquals(false, JsonPath.read(mismatch, "$[0].timeCompatible"));
        assertEquals(0, ((Number) JsonPath.read(mismatch, "$[0].unknownParticipants")).intValue());
    }

    @Test
    void cancelledPlansBlockAttendanceAndAvailabilityAndCanBeDeletedWithProposalHistory() throws Exception {
        Fixture f = closed(2);
        propose(f);
        mvc.perform(auth(patch("/api/v1/plans/{id}/cancel", f.id()), f.owner())).andExpect(status().isOk());
        mvc.perform(
            auth(put("/api/v1/plans/{id}/commitments/me", f.id()), f.owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"CONFIRMED\"}")
        ).andExpect(status().isConflict());
        mvc.perform(
            auth(post("/api/v1/plans/{id}/availabilities", f.id()), f.owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"availableDate\":\"%s\"}".formatted(day))
        ).andExpect(status().isConflict());
        mvc.perform(auth(delete("/api/v1/plans/{id}", f.id()), f.owner())).andExpect(status().isNoContent());
        assertTrue(proposals.findByPlanIdOrderByIdDesc(f.id()).isEmpty());
    }

    @Test
    void notesAtTheAdvertisedLimitArePersisted() throws Exception {
        Fixture f = open(2);
        mvc.perform(
            auth(put("/api/v1/plans/{id}/commitments/me", f.id()), f.owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"INTERESTED\",\"note\":\"%s\"}".formatted("a".repeat(500)))
        )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.note").value("a".repeat(500)));
    }

    @Test
    void concurrentApplicationCannotApplyAnAgreementTwiceAndLaterAttendanceRemainsEditable() throws Exception {
        Fixture f = closed(3);
        long proposal = propose(f);
        ballot(f, f.members().get(1), proposal, true);
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var workers = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Integer> apply = () -> {
                start.await();
                return mvc
                    .perform(
                        auth(patch("/api/v1/plans/{p}/reschedules/{r}/apply", f.id(), proposal), f.owner())
                    )
                    .andReturn()
                    .getResponse()
                    .getStatus();
            };
            var first = workers.submit(apply);
            var second = workers.submit(apply);
            start.countDown();
            List<Integer> statuses = new ArrayList<>(List.of(first.get(), second.get()));
            Collections.sort(statuses);
            assertEquals(200, statuses.getFirst());
            assertTrue(statuses.getLast() >= 400 && statuses.getLast() < 500);
        }
        mvc.perform(auth(get("/api/v1/plans/{id}", f.id()), f.owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.agreementVersion").value(2));
        respond(f.members().get(1), f.id(), "CANT_GO");
        mvc.perform(auth(get("/api/v1/plans/{id}/feasibility", f.id()), f.owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.confirmedParticipants").value(1));
    }

    @Test
    void tiedVotesStayOpenAndAnApprovedProposalCanLoseSupportUntilTheOrganizerAppliesIt() throws Exception {
        Fixture f = closed(4);
        long proposal = propose(f);
        ballot(f, f.members().get(1), proposal, false);
        String tied = ballot(f, f.members().get(2), proposal, false);
        assertEquals("VOTING", JsonPath.read(tied, "$.status"));
        ballot(f, f.members().get(1), proposal, true);
        assertEquals("APPROVED", JsonPath.read(ballot(f, f.members().get(2), proposal, true), "$.status"));
        assertEquals("VOTING", JsonPath.read(ballot(f, f.members().get(1), proposal, false), "$.status"));
        mvc.perform(
            auth(patch("/api/v1/plans/{p}/reschedules/{r}/apply", f.id(), proposal), f.owner())
        ).andExpect(status().isBadRequest());
        mvc.perform(auth(get("/api/v1/plans/{id}", f.id()), f.owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.agreementVersion").value(1));
    }

    @Test
    void recommendationsMergeOverlappingWindowsAndDoNotCountDuplicateDaysTwice() throws Exception {
        Fixture f = open(2);
        availability(f.owner(), f.id(), "08:00", "12:00");
        availability(f.owner(), f.id(), "10:00", "16:00");
        availability(f.members().get(1), f.id(), "09:00", "15:00");
        mvc.perform(auth(get("/api/v1/plans/{id}/date-recommendations", f.id()), f.owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].availableParticipants").value(2))
            .andExpect(jsonPath("$[0].commonStartTime").value("09:00:00"))
            .andExpect(jsonPath("$[0].commonEndTime").value("15:00:00"));
    }

    @Test
    void confirmationMailContainsTheActualAgreedDayWithoutInventingAnHour() throws Exception {
        Fixture f = closed(2);
        notifications.notifyPlanStatusChanged(f.id());
        org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(10)).untilAsserted(() ->
            org.mockito.Mockito.verify(emailService, org.mockito.Mockito.atLeastOnce()).sendHtmlEmail(
            anyString(),
            anyString(),
            org.mockito.ArgumentMatchers.eq("email/plan-closed"),
            org.mockito.ArgumentMatchers.argThat(
                values ->
                    values.get("selectedDate").toString().contains(day.toString()) &&
                    values.get("selectedDate").toString().contains("Hora por acordar") &&
                    values.get("selectedPlace").equals("Parque elegido")
            )
            )
        );
    }

    @Test
    void expiredOptionsCannotMakeAPlanReadyAndMixedDatePlacePayloadsAreRejected() throws Exception {
        Fixture f = open(2);
        for (String invalid : List.of(
            "{\"type\":\"DATE\",\"label\":\"Mixed date\",\"startsOn\":\"%s\",\"location\":{\"latitude\":-12,\"longitude\":-77}}".formatted(
                day
            ),
            "{\"type\":\"PLACE\",\"label\":\"Mixed place\",\"startsOn\":\"%s\",\"location\":{\"latitude\":-12,\"longitude\":-77}}".formatted(
                day
            ),
            "{\"type\":\"DATE\",\"label\":\"Invalid end\",\"startsOn\":\"%s\",\"endsAt\":\"%sT18:00:00\"}".formatted(
                day,
                day
            ),
            "{\"type\":\"DATE\",\"label\":\"Zero duration\",\"startsAt\":\"%sT18:00:00\",\"endsAt\":\"%sT18:00:00\"}".formatted(
                day,
                day
            )
        )) {
            mvc.perform(
                auth(post("/api/v1/plans/{id}/options", f.id()), f.owner())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(invalid)
            ).andExpect(status().isBadRequest());
        }
        long expired = createOption(
            f,
            "{\"type\":\"DATE\",\"label\":\"Date that expires\",\"startsOn\":\"%s\"}".formatted(day)
        );
        long place = createOption(f, placeInput());
        for (Account member : f.members()) {
            voteOption(member, expired);
            voteOption(member, place);
            respond(member, f.id(), "CONFIRMED");
        }
        var option = optionRepository.findById(expired).orElseThrow();
        option.setStartsOn(LocalDate.now(ZoneId.of("America/Lima")).minusDays(1));
        optionRepository.saveAndFlush(option);
        mvc.perform(auth(get("/api/v1/plans/{id}/feasibility", f.id()), f.owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.dateReady").value(false));
        mvc.perform(auth(patch("/api/v1/plans/{id}/close", f.id()), f.owner())).andExpect(
            status().isBadRequest()
        );
        long replacement = createOption(
            f,
            "{\"type\":\"DATE\",\"label\":\"Replacement day\",\"startsOn\":\"%s\"}".formatted(day.plusDays(1))
        );
        for (Account member : f.members()) voteOption(member, replacement);
        mvc.perform(auth(patch("/api/v1/plans/{id}/close", f.id()), f.owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tentativeStartDate").value(day.plusDays(1).toString()));
    }

    @Test
    void reschedulingPreservesMultiDayDurationAndAPlaceOnlyChangeKeepsTheDayRange() throws Exception {
        Fixture f = open(2);
        long date = createOption(
            f,
            "{\"type\":\"DATE\",\"label\":\"Several days\",\"startsAt\":\"%sT18:00:00\",\"endsAt\":\"%sT20:00:00\"}".formatted(
                day,
                day.plusDays(2)
            )
        );
        long place = createOption(f, placeInput());
        for (Account member : f.members()) {
            voteOption(member, date);
            voteOption(member, place);
            respond(member, f.id(), "CONFIRMED");
        }
        body(auth(patch("/api/v1/plans/{id}/close", f.id()), f.owner()), 200);
        String created = body(
            auth(post("/api/v1/plans/{id}/reschedules", f.id()), f.owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\":\"%s\",\"time\":\"19:00\"}".formatted(day.plusDays(3))),
            201
        );
        assertEquals(day.plusDays(5).toString(), JsonPath.read(created, "$.endDate"));
        assertEquals("21:00:00", JsonPath.read(created, "$.endTime"));
        long proposal = id(created);
        ballot(f, f.members().get(1), proposal, true);
        body(auth(patch("/api/v1/plans/{p}/reschedules/{r}/apply", f.id(), proposal), f.owner()), 200);
        mvc.perform(auth(get("/api/v1/plans/{id}", f.id()), f.owner()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tentativeEndDate").value(day.plusDays(5).toString()));
        String movePlace = body(
            auth(post("/api/v1/plans/{id}/reschedules", f.id()), f.owner())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"time\":\"19:00\",\"placeLabel\":\"Other meeting point\",\"location\":{\"latitude\":-12.3,\"longitude\":-77.2}}"
                ),
            201
        );
        assertEquals(day.plusDays(3).toString(), JsonPath.read(movePlace, "$.date"));
        assertEquals(day.plusDays(5).toString(), JsonPath.read(movePlace, "$.endDate"));
        long second = id(movePlace);
        ballot(f, f.members().get(1), second, true);
        body(auth(patch("/api/v1/plans/{p}/reschedules/{r}/apply", f.id(), second), f.owner()), 200);
        String choices = body(auth(get("/api/v1/plans/{id}/options", f.id()), f.owner()), 200);
        assertEquals(
            day.plusDays(5) + "T21:00:00",
            (
                (List<?>) JsonPath.read(choices, "$[?(@.selected == true && @.type == 'DATE')].endsAt")
            ).getFirst()
        );
    }

    private Fixture open(int count) throws Exception {
        List<Account> members = new ArrayList<>();
        for (int i = 0; i < count; i++) members.add(account());
        String result = body(
            auth(post("/api/v1/plans"), members.getFirst())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Coordination test\",\"type\":\"OTHER\",\"minParticipants\":2}"),
            201
        );
        long id = id(result);
        String code = JsonPath.read(result, "$.inviteCode");
        for (Account member : members.subList(1, count))
            body(auth(post("/api/v1/plans/join/{code}", code), member), 201);
        return new Fixture(id, members);
    }

    private Fixture closed(int count) throws Exception {
        Fixture f = open(count);
        long date = createOption(
            f,
            "{\"type\":\"DATE\",\"label\":\"Día elegido\",\"startsOn\":\"%s\"}".formatted(day)
        );
        long place = createOption(f, placeInput());
        for (Account user : f.members()) {
            voteOption(user, date);
            voteOption(user, place);
            respond(user, f.id(), "CONFIRMED");
        }
        body(auth(patch("/api/v1/plans/{id}/close", f.id()), f.owner()), 200);
        return f;
    }

    private Account account() throws Exception {
        String result = body(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"name\":\"Member\",\"email\":\"%s@qsale.test\",\"password\":\"StrongPass1\"}".formatted(
                        UUID.randomUUID()
                    )
                ),
            201
        );
        return new Account(JsonPath.read(result, "$.token"));
    }

    private long createOption(Fixture f, String input) throws Exception {
        return id(
            body(
                auth(post("/api/v1/plans/{id}/options", f.id()), f.owner())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(input),
                201
            )
        );
    }

    private void voteOption(Account user, long option) throws Exception {
        body(auth(post("/api/v1/options/{id}/votes", option), user), 201);
    }

    private void respond(Account user, long plan, String status) throws Exception {
        body(
            auth(put("/api/v1/plans/{id}/commitments/me", plan), user)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"%s\"}".formatted(status)),
            200
        );
    }

    private long propose(Fixture f) throws Exception {
        return id(
            body(
                auth(post("/api/v1/plans/{id}/reschedules", f.id()), f.owner())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"date\":\"%s\"}".formatted(day.plusDays(1))),
                201
            )
        );
    }

    private String ballot(Fixture f, Account user, long proposal, boolean value) throws Exception {
        return body(
            auth(put("/api/v1/plans/{p}/reschedules/{r}/vote", f.id(), proposal), user)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"accepted\":%s}".formatted(value)),
            200
        );
    }

    private void availability(Account user, long plan, String start, String end) throws Exception {
        body(
            auth(post("/api/v1/plans/{id}/availabilities", plan), user)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"availableDate\":\"%s\",\"startTime\":\"%s\",\"endTime\":\"%s\"}".formatted(
                        day,
                        start,
                        end
                    )
                ),
            201
        );
    }

    private String placeInput() {
        return "{\"type\":\"PLACE\",\"label\":\"Parque elegido\",\"location\":{\"latitude\":-12.1,\"longitude\":-77.0}}";
    }

    private String body(MockHttpServletRequestBuilder request, int status) throws Exception {
        return mvc
            .perform(request)
            .andExpect(status().is(status))
            .andReturn()
            .getResponse()
            .getContentAsString();
    }

    private long id(String body) {
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request, Account account) {
        return request.header("Authorization", "Bearer " + account.token());
    }

    private record Account(String token) {}

    private record Fixture(long id, List<Account> members) {
        Account owner() {
            return members.getFirst();
        }
    }
}
