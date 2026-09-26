package com.example.qsale.plan;

import com.example.qsale.AbstractContainerBaseTest;
import com.example.qsale.auth.dto.SignUpRequest;
import com.example.qsale.auth.dto.TokenResponse;
import com.example.qsale.option.domain.OptionType;
import com.example.qsale.option.dto.OptionRequestDto;
import com.example.qsale.participant.domain.ParticipantRole;
import com.example.qsale.participant.domain.PlanParticipant;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.domain.PlanType;
import com.example.qsale.plan.dto.PlanDetailDto;
import com.example.qsale.plan.dto.PlanRequestDto;
import com.example.qsale.user.infrastructure.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class PlanControllerTests extends AbstractContainerBaseTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PlanParticipantRepository participantRepository;

    @Autowired
    private UserRepository userRepository;

    @Test
    void shouldCreatePlanAndRegisterCreatorAsOrganizer() throws Exception {
        String email = uniqueEmail();
        String token = signUp(email);

        PlanDetailDto plan = createPlan(token);

        Long userId = userRepository.findByEmail(email).orElseThrow().getId();
        PlanParticipant organizer = participantRepository.findByPlanIdAndUserId(plan.getId(), userId).orElseThrow();
        assertEquals(ParticipantRole.ORGANIZER, organizer.getRole());
        assertNotNull(plan.getInviteCode());
        assertEquals("Cena viernes", plan.getName());
    }

    @Test
    void shouldReturnForbiddenWhenNonMemberReadsPlan() throws Exception {
        PlanDetailDto plan = createPlan(signUp(uniqueEmail()));
        String outsiderToken = signUp(uniqueEmail());

        mockMvc.perform(get("/api/v1/plans/" + plan.getId()).header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldLetGuestJoinWithInviteCodeOnlyOnce() throws Exception {
        PlanDetailDto plan = createPlan(signUp(uniqueEmail()));
        String guestToken = signUp(uniqueEmail());

        mockMvc.perform(post("/api/v1/plans/join/" + plan.getInviteCode()).header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("JOINED"));

        mockMvc.perform(post("/api/v1/plans/join/" + plan.getInviteCode()).header("Authorization", "Bearer " + guestToken))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldReturnConflictWhenVotingTwiceForSameOption() throws Exception {
        String token = signUp(uniqueEmail());
        PlanDetailDto plan = createPlan(token);
        Long optionId = createDateOption(token, plan.getId());

        mockMvc.perform(post("/api/v1/options/" + optionId + "/votes").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalVotes").value(1));

        mockMvc.perform(post("/api/v1/options/" + optionId + "/votes").header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldNotClosePlanThatIsNotReady() throws Exception {
        String token = signUp(uniqueEmail());
        PlanDetailDto plan = createPlan(token);

        mockMvc.perform(patch("/api/v1/plans/" + plan.getId() + "/close").header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    private String signUp(String email) throws Exception {
        SignUpRequest request = new SignUpRequest();
        request.setName("Test User");
        request.setEmail(email);
        request.setPassword("Secret123");
        String response = mockMvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readValue(response, TokenResponse.class).token();
    }

    private PlanDetailDto createPlan(String token) throws Exception {
        PlanRequestDto request = new PlanRequestDto();
        request.setName("Cena viernes");
        request.setType(PlanType.DINNER);
        request.setBudget(60.0);
        request.setMinParticipants(2);
        request.setTentativeStartDate(LocalDate.now().plusDays(10));
        String response = mockMvc.perform(post("/api/v1/plans").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readValue(response, PlanDetailDto.class);
    }

    private Long createDateOption(String token, Long planId) throws Exception {
        OptionRequestDto request = new OptionRequestDto();
        request.setType(OptionType.DATE);
        request.setLabel("Viernes 8 pm");
        request.setStartsAt(LocalDateTime.now().plusDays(10));
        String response = mockMvc.perform(post("/api/v1/plans/" + planId + "/options").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@utec.edu.pe";
    }
}
