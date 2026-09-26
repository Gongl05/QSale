package com.example.qsale.location;

import com.example.qsale.location.domain.GeoService;
import com.example.qsale.location.domain.Location;
import com.example.qsale.location.dto.TravelEstimateDto;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

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

    @Test
    void midpointShouldBeBetweenTwoNearbyLocations() {
        GeoService geoService = new GeoService(RestClient.create(), "");

        var midpoint = geoService.geographicMidpoint(List.of(miraflores, barranco));

        assertTrue(midpoint.latitude() < miraflores.getLatitude());
        assertTrue(midpoint.latitude() > barranco.getLatitude());
        assertTrue(midpoint.longitude() > miraflores.getLongitude());
        assertTrue(midpoint.longitude() < barranco.getLongitude());
    }

    @Test
    void midpointShouldHandleTheDateLine() {
        GeoService geoService = new GeoService(RestClient.create(), "");

        var midpoint = geoService.geographicMidpoint(List.of(
                new Location(0.0, 179.0, null), new Location(0.0, -179.0, null)));

        assertEquals(0.0, midpoint.latitude(), 0.01);
        assertEquals(180.0, Math.abs(midpoint.longitude()), 0.01);
        assertThrows(IllegalArgumentException.class, () -> geoService.geographicMidpoint(List.of()));
    }
}
