package com.wayfinding.indoor.controller;

import com.wayfinding.indoor.dto.CreateBeaconRequest;
import com.wayfinding.indoor.model.Beacon;
import com.wayfinding.indoor.service.BeaconService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/beacons")
@RequiredArgsConstructor
@Slf4j
public class BeaconController {

    private final BeaconService beaconService;

    @GetMapping
    public ResponseEntity<List<Beacon>> getAllBeacons(@RequestParam(required = false) String building_id,
                                                       @RequestParam(required = false) String floor_id) {
        log.info("GET /api/beacons - Fetching beacons{}{}", 
                 building_id != null ? " for building: " + building_id : "",
                 floor_id != null ? " and floor: " + floor_id : "");
        
        if (floor_id != null && !floor_id.isEmpty()) {
            return ResponseEntity.ok(beaconService.getBeaconsByFloorId(floor_id));
        }
        if (building_id != null && !building_id.isEmpty()) {
            return ResponseEntity.ok(beaconService.getBeaconsByBuildingId(building_id));
        }
        return ResponseEntity.ok(beaconService.getAllBeacons());
    }

    @GetMapping("/{buildingId}/{floorId}")
    public ResponseEntity<List<Beacon>> getBeaconsByBuildingAndFloor(@PathVariable String buildingId,
                                                                      @PathVariable String floorId) {
        log.info("GET /api/beacons/{}/{} - Fetching beacons for building and floor", buildingId, floorId);
        return ResponseEntity.ok(beaconService.getBeaconsByBuildingAndFloor(buildingId, floorId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Beacon> getBeacon(@PathVariable String id) {
        log.info("GET /api/beacons/{} - Fetching beacon by ID", id);
        return beaconService.getBeacon(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.<Beacon>notFound().build());
    }

    @PostMapping
    public ResponseEntity<Beacon> createBeacon(@RequestBody CreateBeaconRequest request) {
        log.info("POST /api/beacons - Creating new beacon: UUID={}, major={}, minor={}", 
            request.getUuid(), request.getMajor(), request.getMinor());
        
        if (request.getBuildingId() == null || request.getBuildingId().isEmpty()) {
            log.error("Building ID is required");
            return ResponseEntity.<Beacon>badRequest().build();
        }
        
        if (request.getFloorId() == null || request.getFloorId().isEmpty()) {
            log.error("Floor ID is required");
            return ResponseEntity.<Beacon>badRequest().build();
        }
        
        if (request.getUuid() == null || request.getUuid().isEmpty()) {
            log.error("UUID is required");
            return ResponseEntity.<Beacon>badRequest().build();
        }
        if (request.getMajor() == null || request.getMinor() == null) {
            log.error("Major and minor are required");
            return ResponseEntity.<Beacon>badRequest().build();
        }

        try {
            Beacon created = beaconService.createBeacon(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalArgumentException e) {
            log.error("Error creating beacon: {}", e.getMessage());
            return ResponseEntity.<Beacon>status(HttpStatus.CONFLICT).build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Beacon> updateBeacon(@PathVariable String id,
                                                @RequestBody CreateBeaconRequest request) {
        log.info("PUT /api/beacons/{} - Updating beacon", id);
        
        return beaconService.updateBeacon(id, request)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.<Beacon>notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBeacon(@PathVariable String id) {
        log.info("DELETE /api/beacons/{} - Deleting beacon", id);
        
        if (beaconService.deleteBeacon(id)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
