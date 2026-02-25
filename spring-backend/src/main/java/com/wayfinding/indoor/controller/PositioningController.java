package com.wayfinding.indoor.controller;

import com.wayfinding.indoor.dto.BeaconScanRequest;
import com.wayfinding.indoor.dto.NavigationRequest;
import com.wayfinding.indoor.dto.NavigationResponse;
import com.wayfinding.indoor.dto.PositionResponse;
import com.wayfinding.indoor.service.NavigationService;
import com.wayfinding.indoor.service.PositioningService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PositioningController {

    private final PositioningService positioningService;
    private final NavigationService navigationService;

    /**
     * Health check endpoint
     */
    @GetMapping("/")
    public Map<String, String> healthCheck() {
        return Map.of(
                "status", "healthy",
                "service", "Indoor Wayfinding API",
                "version", "1.0.0"
        );
    }

    /**
     * Receive beacon scan data and compute user position.
     * POST /api/position
     */
    @PostMapping("/position")
    public PositionResponse computePosition(@RequestBody BeaconScanRequest request) {
        return positioningService.computePosition(request);
    }

    /**
     * Compute navigation route from current position to destination.
     * POST /api/navigate
     */
    @PostMapping("/navigate")
    public NavigationResponse computeRoute(@RequestBody NavigationRequest request) {
        return navigationService.computeRoute(request);
    }
}
