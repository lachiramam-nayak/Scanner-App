package com.wayfinding.indoor.controller;

import com.wayfinding.indoor.dto.CreateFloorRequest;
import com.wayfinding.indoor.model.Floor;
import com.wayfinding.indoor.service.FloorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/floors")
@RequiredArgsConstructor
@Slf4j
public class FloorController {

    private final FloorService floorService;

    @GetMapping
    public ResponseEntity<List<Floor>> getAllFloors(@RequestParam(required = false) String building_id) {
        log.info("GET /api/floors - Fetching all floors{}", building_id != null ? " for building: " + building_id : "");
        
        if (building_id != null && !building_id.isEmpty()) {
            return ResponseEntity.ok(floorService.getFloorsByBuildingId(building_id));
        }
        return ResponseEntity.ok(floorService.getAllFloors());
    }

    @GetMapping("/building/{buildingId}")
    public ResponseEntity<List<Floor>> getFloorsByBuildingId(@PathVariable String buildingId) {
        log.info("GET /api/floors/building/{} - Fetching floors for building", buildingId);
        return ResponseEntity.ok(floorService.getFloorsByBuildingId(buildingId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Floor> getFloor(@PathVariable String id) {
        log.info("GET /api/floors/{} - Fetching floor by ID", id);
        return floorService.getFloor(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/id/{floorId}")
    public ResponseEntity<Floor> getFloorByFloorId(@PathVariable String floorId) {
        log.info("GET /api/floors/id/{} - Fetching floor by floorId", floorId);
        return floorService.getFloorByFloorId(floorId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Floor> createFloor(@RequestBody CreateFloorRequest request) {
        log.info("POST /api/floors - Creating new floor: {} in building: {}", request.getName(), request.getBuildingId());
        
        if (request.getBuildingId() == null || request.getBuildingId().isEmpty()) {
            log.error("Building ID is required");
            return ResponseEntity.badRequest().build();
        }
        
        if (request.getName() == null || request.getName().trim().isEmpty()) {
            log.error("Floor name is required");
            return ResponseEntity.badRequest().build();
        }

        try {
            Floor created = floorService.createFloor(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalArgumentException e) {
            log.error("Error creating floor: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Floor> updateFloor(@PathVariable String id,
                                              @RequestBody CreateFloorRequest request) {
        log.info("PUT /api/floors/{} - Updating floor", id);
        
        return floorService.updateFloor(id, request)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/map")
    public ResponseEntity<Floor> uploadFloorMap(@PathVariable String id,
                                                 @RequestParam("file") MultipartFile file) {
        log.info("POST /api/floors/{}/map - Uploading floor map", id);

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            return floorService.uploadFloorMap(id, file)
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        } catch (IOException e) {
            log.error("Error uploading floor map: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFloor(@PathVariable String id) {
        log.info("DELETE /api/floors/{} - Deleting floor", id);
        
        if (floorService.deleteFloor(id)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
