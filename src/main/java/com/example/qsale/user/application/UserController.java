package com.example.qsale.user.application;

import com.example.qsale.user.domain.UserAvatar;
import com.example.qsale.user.domain.UserService;
import com.example.qsale.user.dto.AvatarRequestDto;
import com.example.qsale.user.dto.ProfileUpdateDto;
import com.example.qsale.user.dto.UserResponseDto;
import com.example.qsale.user.dto.UserUpdateDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<UserResponseDto> getMe() {
        return ResponseEntity.ok(userService.getMe());
    }

    @PutMapping("/me")
    public ResponseEntity<UserResponseDto> updateMe(@Valid @RequestBody UserUpdateDto dto) {
        return ResponseEntity.ok(userService.updateMe(dto));
    }

    @PutMapping("/me/profile")
    public ResponseEntity<UserResponseDto> updateProfile(@Valid @RequestBody ProfileUpdateDto dto) {
        return ResponseEntity.ok(userService.updateProfile(dto));
    }

    @PutMapping("/me/avatar")
    public ResponseEntity<UserResponseDto> updateAvatar(@Valid @RequestBody AvatarRequestDto dto) {
        return ResponseEntity.ok(userService.updateAvatar(dto));
    }

    @DeleteMapping("/me/avatar")
    public ResponseEntity<UserResponseDto> deleteAvatar() {
        return ResponseEntity.ok(userService.deleteAvatar());
    }

    @GetMapping("/{userId}/avatar")
    public ResponseEntity<byte[]> getAvatar(@PathVariable Long userId) {
        UserAvatar avatar = userService.getAvatar(userId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(avatar.getContentType()))
                .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePrivate())
                .body(avatar.getData());
    }
}
