package com.wayfinding.indoor.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

/**
 * DTO for receiving beacon scan data from the mobile app
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BeaconScanRequest {
    private List<ScannedBeacon> beacons;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScannedBeacon {
        private String uuid;
        private Integer major;
        private Integer minor;
        private int rssi;  // Signal strength
    }
}
