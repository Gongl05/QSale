package com.example.qsale.user.domain;

import com.example.qsale.address.domain.AddressType;
import com.example.qsale.address.domain.SavedAddress;
import com.example.qsale.address.infrastructure.SavedAddressRepository;
import com.example.qsale.exceptions.ResourceNotFoundException;
import com.example.qsale.exceptions.UnauthorizedException;
import com.example.qsale.exceptions.InvalidOperationException;
import com.example.qsale.location.domain.Location;
import com.example.qsale.location.dto.LocationDto;
import com.example.qsale.option.events.TravelEstimateRefreshRequestedEvent;
import com.example.qsale.participant.domain.ParticipationStatus;
import com.example.qsale.participant.infrastructure.PlanParticipantRepository;
import com.example.qsale.plan.domain.Plan;
import com.example.qsale.user.dto.AvatarRequestDto;
import com.example.qsale.user.dto.ProfileUpdateDto;
import com.example.qsale.user.dto.RoleUpdateDto;
import com.example.qsale.user.dto.UserResponseDto;
import com.example.qsale.user.dto.UserUpdateDto;
import com.example.qsale.user.infrastructure.UserAvatarRepository;
import com.example.qsale.user.infrastructure.UserRepository;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;

import java.util.Base64;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class UserService implements UserDetailsService {

    private final UserRepository userRepository;
    private final UserAvatarRepository avatarRepository;
    private final SavedAddressRepository addressRepository;
    private final PlanParticipantRepository participantRepository;
    private final ModelMapper modelMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return userRepository.findByEmail(username)
                .orElseThrow(() -> new UsernameNotFoundException("No user found for email: " + username));
    }

    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new UnauthorizedException("No authenticated user");
        }
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new UnauthorizedException("Authenticated user no longer exists"));
    }

    public User getUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id " + userId));
    }

    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email " + email));
    }

    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public UserResponseDto getMe() {
        return modelMapper.map(getCurrentUser(), UserResponseDto.class);
    }

    @PreAuthorize("isAuthenticated()")
    @Transactional
    public UserResponseDto updateMe(UserUpdateDto dto) {
        User user = getCurrentUser();
        if (dto.isRemoveLocation() && dto.getLocation() != null) {
            throw new InvalidOperationException("Cannot set and remove a location in the same request");
        }
        user.setName(dto.getName());
        boolean coordinatesChanged = (dto.isRemoveLocation() && user.getLocation() != null) || dto.getLocation() != null &&
                (user.getLocation() == null ||
                        !Objects.equals(user.getLocation().getLatitude(), dto.getLocation().getLatitude()) ||
                        !Objects.equals(user.getLocation().getLongitude(), dto.getLocation().getLongitude()));
        if (dto.isRemoveLocation()) {
            user.setLocation(null);
            removeMainAddress(user);
        } else if (dto.getLocation() != null) {
            user.setLocation(modelMapper.map(dto.getLocation(), Location.class));
            saveAsMainAddress(user, dto.getLocation());
        }
        UserResponseDto response = modelMapper.map(userRepository.save(user), UserResponseDto.class);
        if (coordinatesChanged) {
            refreshOpenPlanEstimates(user);
        }
        return response;
    }

    @PreAuthorize("isAuthenticated()")
    @Transactional
    public UserResponseDto updateProfile(ProfileUpdateDto dto) {
        User user = getCurrentUser();
        user.setName(dto.getName().strip());
        user.setSurname(blankToNull(dto.getSurname()));
        user.setNickname(blankToNull(dto.getNickname()));
        user.setPhone(blankToNull(dto.getPhone()));
        user.setBirthDate(dto.getBirthDate());
        user.setGender(dto.getGender());
        return modelMapper.map(userRepository.save(user), UserResponseDto.class);
    }

    @PreAuthorize("isAuthenticated()")
    @Transactional
    public UserResponseDto updateAvatar(AvatarRequestDto dto) {
        User user = getCurrentUser();
        byte[] data;
        try {
            data = Base64.getDecoder().decode(dto.getData());
        } catch (IllegalArgumentException e) {
            throw new InvalidOperationException("The picture must be sent as base64");
        }
        UserAvatar avatar = avatarRepository.findByUserId(user.getId())
                .orElseGet(() -> new UserAvatar(user, dto.getContentType(), data));
        avatar.setContentType(dto.getContentType());
        avatar.setData(data);
        avatarRepository.save(avatar);
        user.setAvatarVersion(System.currentTimeMillis());
        return modelMapper.map(userRepository.save(user), UserResponseDto.class);
    }

    @PreAuthorize("isAuthenticated()")
    @Transactional
    public UserResponseDto deleteAvatar() {
        User user = getCurrentUser();
        avatarRepository.findByUserId(user.getId()).ifPresent(avatarRepository::delete);
        user.setAvatarVersion(null);
        return modelMapper.map(userRepository.save(user), UserResponseDto.class);
    }

    /** Only the owner and people who share a plan with them can see a profile picture. */
    @PreAuthorize("isAuthenticated()")
    @Transactional(readOnly = true)
    public UserAvatar getAvatar(Long userId) {
        User current = getCurrentUser();
        if (!current.getId().equals(userId) && !participantRepository.shareAPlan(current.getId(), userId)) {
            throw new ResourceNotFoundException("Picture not found for user " + userId);
        }
        return avatarRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Picture not found for user " + userId));
    }

    /** Recomputes travel times in the user's open plans after their starting point changed. */
    public void refreshOpenPlanEstimates(User user) {
        participantRepository.findByUserIdAndStatus(user.getId(), ParticipationStatus.JOINED).stream()
                .map(participant -> participant.getPlan())
                .filter(Plan::isOpen)
                .map(Plan::getId)
                .distinct()
                .forEach(planId -> eventPublisher.publishEvent(new TravelEstimateRefreshRequestedEvent(this, planId)));
    }

    /**
     * The web app edits a single reference location. It is the same place as the main saved
     * address, so both stay in sync: the main address is updated, or created when missing.
     */
    private void saveAsMainAddress(User user, LocationDto location) {
        SavedAddress main = addressRepository.findByUserIdAndMainTrue(user.getId()).orElse(null);
        if (main == null) {
            main = new SavedAddress(user, "Mi ubicación", AddressType.OTHER, modelMapper.map(location, Location.class));
            main.setMain(true);
            main.setFavorite(true);
            addressRepository.save(main);
            return;
        }
        main.getLocation().setLatitude(location.getLatitude());
        main.getLocation().setLongitude(location.getLongitude());
        main.getLocation().setAddress(location.getAddress());
        main.getLocation().setDistrict(location.getDistrict());
    }

    /** Removing the reference location removes the main address; another saved one takes its place. */
    private void removeMainAddress(User user) {
        SavedAddress main = addressRepository.findByUserIdAndMainTrue(user.getId()).orElse(null);
        if (main == null) {
            return;
        }
        participantRepository.findByOriginAddressId(main.getId())
                .forEach(participant -> participant.setOriginAddress(null));
        addressRepository.delete(main);
        addressRepository.flush();
        List<SavedAddress> others = addressRepository.findByUserIdOrderByMainDescFavoriteDescCreatedAtAsc(user.getId());
        if (!others.isEmpty()) {
            SavedAddress next = others.get(0);
            next.setMain(true);
            Location copy = new Location(next.getLocation().getLatitude(), next.getLocation().getLongitude(),
                    next.getLocation().getAddress());
            copy.setDistrict(next.getLocation().getDistrict());
            user.setLocation(copy);
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @Transactional(readOnly = true)
    public List<UserResponseDto> getAllUsers() {
        return userRepository.findAll().stream()
                .map(user -> modelMapper.map(user, UserResponseDto.class))
                .toList();
    }

    @PreAuthorize("hasAuthority('ADMIN')")
    @Transactional
    public UserResponseDto updateRole(Long userId, RoleUpdateDto dto) {
        List<User> administrators = userRepository.findAdministratorsForUpdate();
        User user = getUserById(userId);
        if (user.isAdmin() && dto.getRole() == Role.USER && administrators.size() <= 1) {
            throw new InvalidOperationException("The last administrator cannot be demoted");
        }
        user.setRole(dto.getRole());
        return modelMapper.map(userRepository.save(user), UserResponseDto.class);
    }
}
