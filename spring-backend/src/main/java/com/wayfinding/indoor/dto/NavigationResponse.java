package com.wayfinding.indoor.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.List;

/**
 * DTO for navigation route response
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NavigationResponse {
    private boolean success;
    private String message;
    private double totalDistance;
    private List<RoutePoint> route;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoutePoint {
        private double x;
        private double y;
        private String type; // start, waypoint, destination
    }
}
