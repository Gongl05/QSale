package com.example.qsale.user.domain;

import com.example.qsale.exceptions.ResourceNotFoundException;
import com.example.qsale.exceptions.UnauthorizedException;
import com.example.qsale.location.domain.Location;
import com.example.qsale.user.dto.RoleUpdateDto;
import com.example.qsale.user.dto.UserResponseDto;
import com.example.qsale.user.dto.UserUpdateDto;
import com.example.qsale.user.infrastructure.UserRepository;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService implements UserDetailsService {

    private final UserRepository userRepository;
    private final ModelMapper modelMapper;

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

    public UserResponseDto getMe() {
        return modelMapper.map(getCurrentUser(), UserResponseDto.class);
    }

    @Transactional
    public UserResponseDto updateMe(UserUpdateDto dto) {
        User user = getCurrentUser();
        user.setName(dto.getName());
        if (dto.getLocation() != null) {
            user.setLocation(modelMapper.map(dto.getLocation(), Location.class));
        }
        return modelMapper.map(userRepository.save(user), UserResponseDto.class);
    }

    public List<UserResponseDto> getAllUsers() {
        return userRepository.findAll().stream()
                .map(user -> modelMapper.map(user, UserResponseDto.class))
                .toList();
    }

    @Transactional
    public UserResponseDto updateRole(Long userId, RoleUpdateDto dto) {
        User user = getUserById(userId);
        user.setRole(dto.getRole());
        return modelMapper.map(userRepository.save(user), UserResponseDto.class);
    }
}
