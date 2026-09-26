package com.example.qsale.vote;

import com.example.qsale.AbstractContainerBaseTest;
import com.example.qsale.option.domain.OptionType;
import com.example.qsale.option.domain.PlanOption;
import com.example.qsale.option.infrastructure.PlanOptionRepository;
import com.example.qsale.plan.domain.Plan;
import com.example.qsale.plan.domain.PlanType;
import com.example.qsale.plan.infrastructure.PlanRepository;
import com.example.qsale.user.domain.Role;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.infrastructure.UserRepository;
import com.example.qsale.vote.domain.Vote;
import com.example.qsale.vote.infrastructure.VoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest
public class VoteRepositoryTests extends AbstractContainerBaseTest {

    @Autowired
    private VoteRepository voteRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PlanRepository planRepository;

    @Autowired
    private PlanOptionRepository optionRepository;

    private User ana;
    private User bob;
    private PlanOption option;

    @BeforeEach
    void setUp() {
        ana = userRepository.save(new User("Ana", "ana.vote@utec.edu.pe", "hashed", Role.USER));
        bob = userRepository.save(new User("Bob", "bob.vote@utec.edu.pe", "hashed", Role.USER));

        Plan plan = new Plan();
        plan.setName("Cena viernes");
        plan.setType(PlanType.DINNER);
        plan.setMinParticipants(2);
        plan.setInviteCode("VOTE0001");
        plan.setCreator(ana);
        planRepository.save(plan);

        option = new PlanOption();
        option.setPlan(plan);
        option.setProposedBy(ana);
        option.setType(OptionType.DATE);
        option.setLabel("Viernes 8 pm");
        option.setStartsAt(LocalDateTime.now().plusDays(7));
        optionRepository.save(option);
    }

    @Test
    void shouldCountVotesOfAnOption() {
        voteRepository.save(new Vote(option, ana));
        voteRepository.save(new Vote(option, bob));

        long votes = voteRepository.countByOptionId(option.getId());

        assertEquals(2, votes);
    }

    @Test
    void shouldKnowIfUserAlreadyVoted() {
        voteRepository.save(new Vote(option, ana));

        boolean anaVoted = voteRepository.existsByOptionIdAndUserId(option.getId(), ana.getId());
        boolean bobVoted = voteRepository.existsByOptionIdAndUserId(option.getId(), bob.getId());

        assertTrue(anaVoted);
        assertFalse(bobVoted);
    }

    @Test
    void shouldRejectSecondVoteOfSameUserForSameOption() {
        voteRepository.saveAndFlush(new Vote(option, ana));

        assertThrows(DataIntegrityViolationException.class,
                () -> voteRepository.saveAndFlush(new Vote(option, ana)));
    }
}
