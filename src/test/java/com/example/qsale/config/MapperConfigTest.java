package com.example.qsale.config;

import com.example.qsale.availability.domain.Availability;
import com.example.qsale.availability.dto.AvailabilityResponseDto;
import com.example.qsale.commitment.domain.CommitmentResponse;
import com.example.qsale.commitment.domain.CommitmentStatus;
import com.example.qsale.commitment.dto.CommitmentResponseDto;
import com.example.qsale.option.domain.OptionType;
import com.example.qsale.option.domain.PlanOption;
import com.example.qsale.option.dto.OptionResponseDto;
import com.example.qsale.participant.domain.ParticipantRole;
import com.example.qsale.participant.domain.PlanParticipant;
import com.example.qsale.participant.dto.ParticipantResponseDto;
import com.example.qsale.plan.domain.Plan;
import com.example.qsale.plan.dto.PlanDetailDto;
import com.example.qsale.user.domain.Role;
import com.example.qsale.user.domain.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.modelmapper.ModelMapper;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MapperConfigTest {

    private ModelMapper modelMapper;
    private User user;
    private Plan plan;

    @BeforeEach
    void setUp() {
        modelMapper = new MapperConfig().modelMapper();
        user = new User("Gonzalo", "gonza@example.com", "encoded-password", Role.USER);
        user.setId(7L);
        plan = new Plan();
        plan.setId(11L);
        plan.setCreator(user);
    }

    @Test
    void mapsNestedCreatorFieldsInPlanResponse() {
        PlanDetailDto response = modelMapper.map(plan, PlanDetailDto.class);

        assertEquals(7L, response.getCreatorId());
        assertEquals("Gonzalo", response.getCreatorName());
    }

    @Test
    void mapsNestedUserFieldsInParticipantResponse() {
        PlanParticipant participant = new PlanParticipant(plan, user, ParticipantRole.GUEST);
        participant.setId(13L);

        ParticipantResponseDto response = modelMapper.map(participant, ParticipantResponseDto.class);

        assertEquals(11L, response.getPlanId());
        assertEquals(7L, response.getUserId());
        assertEquals("Gonzalo", response.getUserName());
        assertEquals("gonza@example.com", response.getUserEmail());
    }

    @Test
    void mapsNestedFieldsInOptionAvailabilityAndCommitmentResponses() {
        PlanOption option = new PlanOption();
        option.setPlan(plan);
        option.setProposedBy(user);
        option.setType(OptionType.DATE);
        OptionResponseDto optionResponse = modelMapper.map(option, OptionResponseDto.class);

        Availability availability = new Availability(plan, user, LocalDate.now(), null, null);
        AvailabilityResponseDto availabilityResponse = modelMapper.map(availability, AvailabilityResponseDto.class);

        CommitmentResponse commitment = new CommitmentResponse(plan, user, CommitmentStatus.CONFIRMED);
        CommitmentResponseDto commitmentResponse = modelMapper.map(commitment, CommitmentResponseDto.class);

        assertEquals("Gonzalo", optionResponse.getProposedByName());
        assertEquals(7L, availabilityResponse.getUserId());
        assertEquals("Gonzalo", availabilityResponse.getUserName());
        assertEquals(7L, commitmentResponse.getUserId());
        assertEquals("Gonzalo", commitmentResponse.getUserName());
    }
}
