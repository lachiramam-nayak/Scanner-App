package com.wayfinding.indoor.service;

import com.wayfinding.indoor.dto.CreateFloorRequest;
import com.wayfinding.indoor.model.Floor;
import com.wayfinding.indoor.repository.FloorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class FloorService {

    private final FloorRepository floorRepository;

    /**
     * Get all floors
     */
    public List<Floor> getAllFloors() {
        log.info("Fetching all floors");
        return floorRepository.findAll();
    }

    /**
     * Get floors by buildingId, ordered by floor number
     */
    public List<Floor> getFloorsByBuildingId(String buildingId) {
        log.info("Fetching floors for building: {}", buildingId);
        return floorRepository.findByBuildingIdOrderByFloorNumberAsc(buildingId);
    }

    /**
     * Get floor by MongoDB ID
     */
    public Optional<Floor> getFloor(String id) {
        log.info("Fetching floor with ID: {}", id);
        return floorRepository.findById(id);
    }

    /**
     * Get floor by unique floorId
     */
    public Optional<Floor> getFloorByFloorId(String floorId) {
        log.info("Fetching floor with floorId: {}", floorId);
        return floorRepository.findByFloorId(floorId);
    }

    /**
     * Create a new floor
     */
    public Floor createFloor(CreateFloorRequest request) {
        log.info("Creating floor: {} in building: {}", request.getName(), request.getBuildingId());

        // Generate floorId if not provided
        String floorId = request.getFloorId();
        if (floorId == null || floorId.trim().isEmpty()) {
            floorId = "FLR-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            log.info("Generated floorId: {}", floorId);
        }

        // Check if floorId already exists
        if (floorRepository.findByFloorId(floorId).isPresent()) {
            throw new IllegalArgumentException("Floor with floorId '" + floorId + "' already exists");
        }

        // Create floor with default dimensions if not provided
        int width = request.getWidth() > 0 ? request.getWidth() : 1000;
        int height = request.getHeight() > 0 ? request.getHeight() : 800;
        double scale = request.getScale() > 0 ? request.getScale() : 10.0;

        Floor floor = new Floor(
                floorId,
                request.getBuildingId(),
                request.getFloorNumber(),
                request.getName(),
                width,
                height,
                scale
        );

        // Set map image if provided
        if (request.getMapImage() != null && !request.getMapImage().isEmpty()) {
            floor.setMapImage(request.getMapImage());
        }

        // Set custom map image URL if provided, otherwise use default
        if (request.getMapImageUrl() != null && !request.getMapImageUrl().isEmpty()) {
            floor.setMapImageUrl(request.getMapImageUrl());
        } else {
            floor.setMapImageUrl("/maps/" + request.getBuildingId() + "/" + floorId + ".png");
        }

        Floor saved = floorRepository.save(floor);
        log.info("Floor created successfully with ID: {}", saved.getId());
        return saved;
    }

    /**
     * Update an existing floor
     */
    public Optional<Floor> updateFloor(String id, CreateFloorRequest request) {
        log.info("Updating floor with ID: {}", id);

        return floorRepository.findById(id).map(floor -> {
            if (request.getFloorNumber() > 0) {
                floor.setFloorNumber(request.getFloorNumber());
            }
            if (request.getName() != null) {
                floor.setName(request.getName());
            }
            if (request.getWidth() > 0) {
                floor.setWidth(request.getWidth());
            }
            if (request.getHeight() > 0) {
                floor.setHeight(request.getHeight());
            }
            if (request.getScale() > 0) {
                floor.setScale(request.getScale());
            }
            if (request.getMapImage() != null) {
                floor.setMapImage(request.getMapImage());
            }
            if (request.getMapImageUrl() != null) {
                floor.setMapImageUrl(request.getMapImageUrl());
            }
            floor.setUpdatedAt(LocalDateTime.now());

            Floor saved = floorRepository.save(floor);
            log.info("Floor updated successfully");
            return saved;
        });
    }

    /**
     * Upload and set a floor map image.
     */
    public Optional<Floor> uploadFloorMap(String id, MultipartFile file) throws IOException {
        Optional<Floor> floorOpt = floorRepository.findById(id);
        if (floorOpt.isEmpty()) {
            return Optional.empty();
        }

        Floor floor = floorOpt.get();

        String originalName = file.getOriginalFilename();
        String ext = "png";
        if (originalName != null && originalName.contains(".")) {
            ext = originalName.substring(originalName.lastIndexOf('.') + 1).toLowerCase();
        }
        if (!ext.matches("png|jpg|jpeg|webp")) {
            ext = "png";
        }

        Path baseDir = Paths.get(System.getProperty("user.dir"), "uploads", "maps", floor.getBuildingId());
        String filename = floor.getFloorId() + "." + ext;
        Path target = baseDir.resolve(filename);
        Files.createDirectories(target.getParent());
        file.transferTo(target.toFile());

        floor.setMapImageUrl("/maps/" + floor.getBuildingId() + "/" + filename);
        floor.setUpdatedAt(LocalDateTime.now());
        Floor saved = floorRepository.save(floor);
        log.info("Floor map uploaded: {}", saved.getMapImageUrl());
        return Optional.of(saved);
    }

    /**
     * Delete a floor
     */
    public boolean deleteFloor(String id) {
        log.info("Deleting floor with ID: {}", id);

        if (floorRepository.existsById(id)) {
            floorRepository.deleteById(id);
            log.info("Floor deleted successfully");
            return true;
        }
        log.warn("Floor with ID {} not found", id);
        return false;
    }
}
