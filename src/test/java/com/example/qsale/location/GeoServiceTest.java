package com.example.qsale.location;

import com.example.qsale.location.domain.GeoService;
import com.example.qsale.location.domain.Location;
import com.example.qsale.location.dto.TravelEstimateDto;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GeoServiceTest {

    private final Location miraflores = new Location(-12.1211, -77.0297, "Av. Larco 345");
    private final Location barranco = new Location(-12.1486, -77.0219, "Av. Pedro de Osma 110");

    @Test
    void haversineShouldBeZeroForSamePoint() {
        GeoService geoService = new GeoService(RestClient.create(), "");

        double distance = geoService.haversineKm(miraflores, miraflores);

        assertEquals(0.0, distance, 0.0001);
    }

    @Test
    void shouldUseStraightLineDistanceWhenThereIsNoApiKey() {
        GeoService geoService = new GeoService(RestClient.create(), "");

        TravelEstimateDto estimate = geoService.estimateAverageTravel(List.of(miraflores), barranco);

        assertTrue(estimate.avgDistanceKm() > 3.0 && estimate.avgDistanceKm() < 3.4);
        assertTrue(estimate.avgTravelMinutes() > 0);
    }

    @Test
    void shouldFallBackToStraightLineWhenMapsApiIsUnreachable() {
        RestClient unreachableApi = RestClient.builder().baseUrl("http://localhost:1").build();
        GeoService geoService = new GeoService(unreachableApi, "fake-key");

        TravelEstimateDto estimate = geoService.estimateAverageTravel(List.of(miraflores, barranco), barranco);

        double expectedAverage = geoService.haversineKm(miraflores, barranco) / 2;
        assertEquals(expectedAverage, estimate.avgDistanceKm(), 0.01);
    }
}
