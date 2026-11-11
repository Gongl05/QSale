package com.example.qsale.location;

import com.example.qsale.location.domain.GeoService;
import com.example.qsale.location.domain.Location;
import com.example.qsale.location.dto.TravelEstimateDto;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

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

    @Test
    void incompleteRoutesUseTheSameFallbackForTheEntireGroup() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://maps.test");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://maps.test/v2/matrix/driving-car"))
                .andRespond(withSuccess("{\"distances\":[[0.01],[null]],\"durations\":[[10],[null]]}",
                        MediaType.APPLICATION_JSON));
        GeoService service = new GeoService(builder.build(), "test-key");

        TravelEstimateDto estimate = service.estimateAverageTravel(List.of(miraflores, barranco), barranco);

        assertEquals(service.haversineKm(miraflores, barranco) / 2, estimate.avgDistanceKm(), 0.01);
        server.verify();
    }

    @Test
    void completeRoutesAverageAllParticipantsAndConvertSecondsToMinutes() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://maps.test");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://maps.test/v2/matrix/driving-car"))
                .andRespond(withSuccess("{\"distances\":[[1],[3]],\"durations\":[[60],[180]]}",
                        MediaType.APPLICATION_JSON));
        GeoService service = new GeoService(builder.build(), "test-key");

        TravelEstimateDto estimate = service.estimateAverageTravel(List.of(miraflores, barranco), barranco);

        assertEquals(2.0, estimate.avgDistanceKm());
        assertEquals(2, estimate.avgTravelMinutes());
        server.verify();
    }

    @Test
    void oppositeLocationsHaveNoUniqueMidpoint() {
        GeoService service = new GeoService(RestClient.create(), "");
        assertNull(service.geographicMidpoint(List.of(new Location(0.0, 0.0, null),
                new Location(0.0, 180.0, null))));
    }
}
