package com.wayfinding.indoor.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScannedBeacon {
    private String mac;
    private int rssi;  // Received Signal Strength Indicator (negative value, e.g., -50 to -100)
}
