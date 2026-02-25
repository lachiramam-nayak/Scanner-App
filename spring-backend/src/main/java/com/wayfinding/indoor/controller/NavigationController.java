package com.wayfinding.indoor.controller;

import com.wayfinding.indoor.dto.NavigationPathResponse;
import com.wayfinding.indoor.dto.NavigationRecalculateRequest;
import com.wayfinding.indoor.dto.NavigationRequest;
import com.wayfinding.indoor.dto.NavigationResponse;
import com.wayfinding.indoor.service.GraphNavigationService;
import com.wayfinding.indoor.service.NavigationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/navigation")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Navigation", description = "Pathfinding APIs")
public class NavigationController {

    private final NavigationService navigationService;
    private final GraphNavigationService graphNavigationService;

    @GetMapping
    @Operation(summary = "Compute shortest path using navigation graph")
    public ResponseEntity<NavigationPathResponse> getNavigation(
            @RequestParam String buildingId,
            @RequestParam String floorId,
            @RequestParam double fromX,
            @RequestParam double fromY,
            @RequestParam double toX,
            @RequestParam double toY
    ) {
        log.info("GET /api/navigation - building={}, floor={}, from=({},{}), to=({},{})",
                buildingId, floorId, fromX, fromY, toX, toY);
        return ResponseEntity.ok(
                graphNavigationService.computePath(buildingId, floorId, fromX, fromY, toX, toY)
        );
    }

    @PostMapping("/recalculate")
    @Operation(summary = "Recalculate route if deviated (legacy)")
    public ResponseEntity<NavigationResponse> recalculate(@RequestBody NavigationRecalculateRequest request) {
        log.info("POST /api/navigation/recalculate - floor={}, current=({},{}), dest=({},{})",
                request.getFloorId(), request.getCurrentX(), request.getCurrentY(),
                request.getDestX(), request.getDestY());
        return ResponseEntity.ok(navigationService.recalculateIfDeviated(request));
    }
}
