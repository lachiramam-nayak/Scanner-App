package com.wayfinding.indoor.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ComputePositionRequest {
    private String buildingId;
    private String floorId;
    private List<ScannedBeacon> scannedBeacons;
}
