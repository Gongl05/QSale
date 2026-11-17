package com.example.qsale.address.application;

import com.example.qsale.address.domain.SavedAddressService;
import com.example.qsale.address.dto.SavedAddressRequestDto;
import com.example.qsale.address.dto.SavedAddressResponseDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users/me/addresses")
@RequiredArgsConstructor
public class SavedAddressController {

    private final SavedAddressService addressService;

    @GetMapping
    public ResponseEntity<List<SavedAddressResponseDto>> getMyAddresses() {
        return ResponseEntity.ok(addressService.getMyAddresses());
    }

    @PostMapping
    public ResponseEntity<SavedAddressResponseDto> createAddress(@Valid @RequestBody SavedAddressRequestDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(addressService.createAddress(dto));
    }

    @PutMapping("/{addressId}")
    public ResponseEntity<SavedAddressResponseDto> updateAddress(@PathVariable Long addressId,
                                                                 @Valid @RequestBody SavedAddressRequestDto dto) {
        return ResponseEntity.ok(addressService.updateAddress(addressId, dto));
    }

    @DeleteMapping("/{addressId}")
    public ResponseEntity<Void> deleteAddress(@PathVariable Long addressId) {
        addressService.deleteAddress(addressId);
        return ResponseEntity.noContent().build();
    }
}
