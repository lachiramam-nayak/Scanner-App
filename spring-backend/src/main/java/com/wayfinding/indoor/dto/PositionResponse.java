package com.wayfinding.indoor.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

/**
 * DTO for computed user position response
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PositionResponse {
    private String buildingId;
    private String buildingName;
    private String floorId;
    private String floorName;
    private int floorNumber;
    private double x;
    private double y;
    private String method; // mac
    private int beaconsUsed;
    private boolean valid;
    private String errorMessage;
}
