package com.example.qsale.address.infrastructure;

import com.example.qsale.address.domain.SavedAddress;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedAddressRepository extends JpaRepository<SavedAddress, Long> {

    List<SavedAddress> findByUserIdOrderByMainDescFavoriteDescCreatedAtAsc(Long userId);

    Optional<SavedAddress> findByIdAndUserId(Long id, Long userId);

    long countByUserId(Long userId);

    Optional<SavedAddress> findByUserIdAndMainTrue(Long userId);
}
