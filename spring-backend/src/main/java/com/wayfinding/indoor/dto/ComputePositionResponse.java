package com.wayfinding.indoor.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ComputePositionResponse {
    private String buildingId;
    private String floorId;
    private double x;
    private double y;
    private int matchedBeaconCount;  // Number of beacons matched with stored records
    private String method;  // "weighted-rssi", "nearest-beacon", or "no-match"
    private double confidence;  // 0.0-1.0 confidence score
}
