package com.wayfinding.indoor.controller;

import com.wayfinding.indoor.dto.CreateBuildingRequest;
import com.wayfinding.indoor.model.Building;
import com.wayfinding.indoor.service.BuildingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/buildings")
@RequiredArgsConstructor
@Slf4j
public class BuildingController {

    private final BuildingService buildingService;

    /**
     * GET all buildings
     * @return List of all buildings
     */
    @GetMapping
    public ResponseEntity<List<Building>> getAllBuildings() {
        log.info("GET /api/buildings - Fetching all buildings");
        List<Building> buildings = buildingService.getAllBuildings();
        return ResponseEntity.ok(buildings);
    }

    /**
     * GET building by MongoDB ID
     * @param id MongoDB document ID
     * @return Building if found
     */
    @GetMapping("/{id}")
    public ResponseEntity<Building> getBuilding(@PathVariable String id) {
        log.info("GET /api/buildings/{} - Fetching building by ID", id);
        return buildingService.getBuilding(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET building by unique buildingId
     * @param buildingId Unique business identifier
     * @return Building if found
     */
    @GetMapping("/id/{buildingId}")
    public ResponseEntity<Building> getBuildingByBuildingId(@PathVariable String buildingId) {
        log.info("GET /api/buildings/id/{} - Fetching building by buildingId", buildingId);
        return buildingService.getBuildingByBuildingId(buildingId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * POST create a new building
     * @param request Building creation request with buildingId, name, description, address, totalFloors
     * @return Created building with HTTP 201
     */
    @PostMapping
    public ResponseEntity<Building> createBuilding(@RequestBody CreateBuildingRequest request) {
        log.info("POST /api/buildings - Creating new building: {}", request.getName());
        
        if (request.getName() == null || request.getName().trim().isEmpty()) {
            log.error("Building name is required");
            return ResponseEntity.badRequest().build();
        }

        try {
            Building created = buildingService.createBuilding(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (IllegalArgumentException e) {
            log.error("Error creating building: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
    }

    /**
     * PUT update an existing building
     * @param id MongoDB document ID
     * @param request Building update request
     * @return Updated building if found
     */
    @PutMapping("/{id}")
    public ResponseEntity<Building> updateBuilding(@PathVariable String id,
                                                    @RequestBody CreateBuildingRequest request) {
        log.info("PUT /api/buildings/{} - Updating building", id);
        return buildingService.updateBuilding(id, request)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * DELETE a building
     * @param id MongoDB document ID
     * @return HTTP 204 if deleted, 404 if not found
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBuilding(@PathVariable String id) {
        log.info("DELETE /api/buildings/{} - Deleting building", id);
        if (buildingService.deleteBuilding(id)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
