package com.wayfinding.indoor.service;

import com.wayfinding.indoor.dto.CreateBuildingRequest;
import com.wayfinding.indoor.model.Building;
import com.wayfinding.indoor.repository.BuildingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class BuildingService {

    private final BuildingRepository buildingRepository;

    /**
     * Get all buildings
     */
    public List<Building> getAllBuildings() {
        log.info("Fetching all buildings");
        return buildingRepository.findAll();
    }

    /**
     * Get building by MongoDB ID
     */
    public Optional<Building> getBuilding(String id) {
        log.info("Fetching building with ID: {}", id);
        return buildingRepository.findById(id);
    }

    /**
     * Get building by unique buildingId
     */
    public Optional<Building> getBuildingByBuildingId(String buildingId) {
        log.info("Fetching building with buildingId: {}", buildingId);
        return buildingRepository.findByBuildingId(buildingId);
    }

    /**
     * Create a new building
     */
    public Building createBuilding(CreateBuildingRequest request) {
        log.info("Creating building: {}", request.getName());

        // Generate buildingId if not provided
        String buildingId = request.getBuildingId();
        if (buildingId == null || buildingId.trim().isEmpty()) {
            buildingId = "BLD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            log.info("Generated buildingId: {}", buildingId);
        }

        // Check if buildingId already exists
        if (buildingRepository.findByBuildingId(buildingId).isPresent()) {
            throw new IllegalArgumentException("Building with buildingId '" + buildingId + "' already exists");
        }

        Building building = new Building(
                buildingId,
                request.getName(),
                request.getDescription(),
                request.getAddress(),
                request.getTotalFloors()
        );

        Building saved = buildingRepository.save(building);
        log.info("Building created successfully with ID: {}", saved.getId());
        return saved;
    }

    /**
     * Update an existing building
     */
    public Optional<Building> updateBuilding(String id, CreateBuildingRequest request) {
        log.info("Updating building with ID: {}", id);

        return buildingRepository.findById(id).map(building -> {
            if (request.getName() != null) {
                building.setName(request.getName());
            }
            if (request.getDescription() != null) {
                building.setDescription(request.getDescription());
            }
            if (request.getAddress() != null) {
                building.setAddress(request.getAddress());
            }
            if (request.getTotalFloors() > 0) {
                building.setTotalFloors(request.getTotalFloors());
            }
            building.setUpdatedAt(LocalDateTime.now());

            Building saved = buildingRepository.save(building);
            log.info("Building updated successfully");
            return saved;
        });
    }

    /**
     * Delete a building
     */
    public boolean deleteBuilding(String id) {
        log.info("Deleting building with ID: {}", id);

        if (buildingRepository.existsById(id)) {
            buildingRepository.deleteById(id);
            log.info("Building deleted successfully");
            return true;
        }
        log.warn("Building with ID {} not found", id);
        return false;
    }
}
