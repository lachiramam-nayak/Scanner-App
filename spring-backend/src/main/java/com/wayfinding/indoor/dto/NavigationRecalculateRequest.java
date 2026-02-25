package com.wayfinding.indoor.dto;

import lombok.Data;

import java.util.List;

@Data
public class NavigationRecalculateRequest {
    private String floorId;
    private double currentX;
    private double currentY;
    private double destX;
    private double destY;
    private Double deviationThreshold;
    private List<RoutePointInput> previousRoute;

    @Data
    public static class RoutePointInput {
        private double x;
        private double y;
        private String type;
    }
}
