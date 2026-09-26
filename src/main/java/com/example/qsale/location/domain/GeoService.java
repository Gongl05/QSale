package com.example.qsale.location.domain;

import com.example.qsale.exceptions.ExternalServiceException;
import com.example.qsale.location.dto.MatrixRequestDto;
import com.example.qsale.location.dto.MatrixResponseDto;
import com.example.qsale.location.dto.TravelEstimateDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.IntStream;

@Service
public class GeoService {

    private static final double EARTH_RADIUS_KM = 6371.0;
    private static final double AVERAGE_CITY_SPEED_KMH = 25.0;

    private final Logger logger = LoggerFactory.getLogger(GeoService.class);

    private final RestClient mapsRestClient;
    private final String apiKey;

    public GeoService(RestClient mapsRestClient, @Value("${maps.api-key}") String apiKey) {
        this.mapsRestClient = mapsRestClient;
        this.apiKey = apiKey;
    }

    public TravelEstimateDto estimateAverageTravel(List<Location> origins, Location destination) {
        if (apiKey == null || apiKey.isBlank()) {
            return estimateWithHaversine(origins, destination);
        }
        try {
            return estimateWithMatrixApi(origins, destination);
        } catch (ExternalServiceException e) {
            logger.warn("{}. Using straight-line distance instead", e.getMessage());
            return estimateWithHaversine(origins, destination);
        }
    }

    private TravelEstimateDto estimateWithMatrixApi(List<Location> origins, Location destination) {
        List<List<Double>> locations = new ArrayList<>();
        origins.forEach(origin -> locations.add(List.of(origin.getLongitude(), origin.getLatitude())));
        locations.add(List.of(destination.getLongitude(), destination.getLatitude()));
        MatrixRequestDto request = new MatrixRequestDto(locations,
                IntStream.range(0, origins.size()).boxed().toList(), List.of(origins.size()),
                List.of("distance", "duration"), "km");
        try {
            MatrixResponseDto response = mapsRestClient.post()
                    .uri("/v2/matrix/driving-car")
                    .header("Authorization", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(MatrixResponseDto.class);
            return toEstimate(response);
        } catch (RestClientException e) {
            throw new ExternalServiceException("OpenRouteService request failed: " + e.getMessage());
        }
    }

    private TravelEstimateDto toEstimate(MatrixResponseDto response) {
        if (response == null || response.distances() == null || response.durations() == null) {
            throw new ExternalServiceException("OpenRouteService returned an empty matrix");
        }
        double avgKm = average(response.distances());
        double avgSeconds = average(response.durations());
        if (Double.isNaN(avgKm) || Double.isNaN(avgSeconds)) {
            throw new ExternalServiceException("OpenRouteService could not route any origin");
        }
        return new TravelEstimateDto(round(avgKm), (int) Math.round(avgSeconds / 60));
    }

    private double average(List<List<Double>> matrix) {
        return matrix.stream()
                .map(row -> row.getFirst())
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(Double.NaN);
    }

    private TravelEstimateDto estimateWithHaversine(List<Location> origins, Location destination) {
        double avgKm = origins.stream()
                .mapToDouble(origin -> haversineKm(origin, destination))
                .average()
                .orElse(0);
        int minutes = (int) Math.round(avgKm / AVERAGE_CITY_SPEED_KMH * 60);
        return new TravelEstimateDto(round(avgKm), minutes);
    }

    public double haversineKm(Location from, Location to) {
        double latDistance = Math.toRadians(to.getLatitude() - from.getLatitude());
        double lonDistance = Math.toRadians(to.getLongitude() - from.getLongitude());
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(from.getLatitude())) * Math.cos(Math.toRadians(to.getLatitude()))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
