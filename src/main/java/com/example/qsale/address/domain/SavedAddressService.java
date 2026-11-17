package com.example.qsale.address.domain;

import com.example.qsale.address.dto.SavedAddressRequestDto;
import com.example.qsale.address.dto.SavedAddressResponseDto;
import com.example.qsale.address.infrastructure.SavedAddressRepository;
import com.example.qsale.exceptions.ResourceNotFoundException;
import com.example.qsale.location.domain.Location;
import com.example.qsale.location.dto.LocationDto;
import com.example.qsale.option.events.TravelEstimateRefreshRequestedEvent;
import com.example.qsale.participant.domain.PlanParticipant;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.user.domain.User;
import com.example.qsale.user.domain.UserService;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

/**
 * Saved addresses of the current user. The main address is copied into {@code User.location},
 * which travel estimates and the group midpoint use when a participant did not pick another
 * address for a plan.
 */
@Service
@RequiredArgsConstructor
public class SavedAddressService {

    private final SavedAddressRepository addressRepository;
    private final PlanParticipantRepository participantRepository;
    private final UserService userService;
    private final ModelMapper modelMapper;
    private final ApplicationEventPublisher eventPublisher;

    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public List<SavedAddressResponseDto> getMyAddresses() {
        User user = userService.getCurrentUser();
        return findAll(user).stream()
                .map(address -> modelMapper.map(address, SavedAddressResponseDto.class))
                .toList();
    }

    @PreAuthorize("isAuthenticated()")
    @Transactional
    public SavedAddressResponseDto createAddress(SavedAddressRequestDto dto) {
        User user = userService.getCurrentUser();
        boolean first = addressRepository.countByUserId(user.getId()) == 0;
        SavedAddress address = new SavedAddress(user, dto.getLabel().strip(), dto.getType(),
                modelMapper.map(dto.getLocation(), Location.class));
        address.setFavorite(dto.isFavorite());
        addressRepository.save(address);
        if (first || dto.isMain()) {
            makeMain(user, address);
        }
        return modelMapper.map(address, SavedAddressResponseDto.class);
    }

    @PreAuthorize("isAuthenticated()")
    @Transactional
    public SavedAddressResponseDto updateAddress(Long addressId, SavedAddressRequestDto dto) {
        User user = userService.getCurrentUser();
        SavedAddress address = getOwnAddress(addressId, user);
        boolean moved = !Objects.equals(address.getLocation().getLatitude(), dto.getLocation().getLatitude())
                || !Objects.equals(address.getLocation().getLongitude(), dto.getLocation().getLongitude());
        address.setLabel(dto.getLabel().strip());
        address.setType(dto.getType());
        address.setFavorite(dto.isFavorite());
        copyInto(dto.getLocation(), address.getLocation());
        if (dto.isMain() && !address.isMain()) {
            makeMain(user, address);
        } else if (address.isMain()) {
            // Keep the copy in the user's profile in sync with the edited address.
            user.setLocation(copyOf(address.getLocation()));
            if (moved) {
                userService.refreshOpenPlanEstimates(user);
            }
        }
        if (moved) {
            refreshPlans(participantRepository.findByOriginAddressId(addressId));
        }
        return modelMapper.map(address, SavedAddressResponseDto.class);
    }

    @PreAuthorize("isAuthenticated()")
    @Transactional
    public void deleteAddress(Long addressId) {
        User user = userService.getCurrentUser();
        SavedAddress address = getOwnAddress(addressId, user);
        // Plans that started from this address go back to the user's main address.
        List<PlanParticipant> usingIt = participantRepository.findByOriginAddressId(addressId);
        usingIt.forEach(participant -> participant.setOriginAddress(null));
        boolean wasMain = address.isMain();
        addressRepository.delete(address);
        addressRepository.flush();
        if (wasMain) {
            List<SavedAddress> others = findAll(user);
            if (others.isEmpty()) {
                user.setLocation(null);
                userService.refreshOpenPlanEstimates(user);
            } else {
                makeMain(user, others.get(0));
            }
        }
        refreshPlans(usingIt);
    }

    private void makeMain(User user, SavedAddress main) {
        findAll(user).forEach(address -> address.setMain(address.getId().equals(main.getId())));
        main.setMain(true);
        user.setLocation(copyOf(main.getLocation()));
        userService.refreshOpenPlanEstimates(user);
    }

    private List<SavedAddress> findAll(User user) {
        return addressRepository.findByUserIdOrderByMainDescFavoriteDescCreatedAtAsc(user.getId());
    }

    private SavedAddress getOwnAddress(Long addressId, User user) {
        return addressRepository.findByIdAndUserId(addressId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Address not found with id " + addressId));
    }

    private void refreshPlans(List<PlanParticipant> participants) {
        participants.stream()
                .map(PlanParticipant::getPlan)
                .filter(plan -> plan.isOpen())
                .map(plan -> plan.getId())
                .distinct()
                .forEach(planId -> eventPublisher.publishEvent(new TravelEstimateRefreshRequestedEvent(this, planId)));
    }

    private void copyInto(LocationDto source, Location target) {
        target.setLatitude(source.getLatitude());
        target.setLongitude(source.getLongitude());
        target.setAddress(source.getAddress());
        target.setDistrict(source.getDistrict());
    }

    private Location copyOf(Location source) {
        Location copy = new Location(source.getLatitude(), source.getLongitude(), source.getAddress());
        copy.setDistrict(source.getDistrict());
        return copy;
    }
}
