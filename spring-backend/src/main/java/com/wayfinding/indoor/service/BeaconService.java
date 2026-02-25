package com.wayfinding.indoor.service;

import com.wayfinding.indoor.dto.CreateBeaconRequest;
import com.wayfinding.indoor.model.Beacon;
import com.wayfinding.indoor.repository.BeaconRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class BeaconService {

    private final BeaconRepository beaconRepository;

    /**
     * Get all beacons
     */
    public List<Beacon> getAllBeacons() {
        log.info("Fetching all beacons");
        return beaconRepository.findAll();
    }

    /**
     * Get beacons by buildingId
     */
    public List<Beacon> getBeaconsByBuildingId(String buildingId) {
        log.info("Fetching beacons for building: {}", buildingId);
        return beaconRepository.findByBuildingId(buildingId);
    }

    /**
     * Get beacons by floorId
     */
    public List<Beacon> getBeaconsByFloorId(String floorId) {
        log.info("Fetching beacons for floor: {}", floorId);
        return beaconRepository.findByFloorId(floorId);
    }

    /**
     * Get beacons by buildingId and floorId
     */
    public List<Beacon> getBeaconsByBuildingAndFloor(String buildingId, String floorId) {
        log.info("Fetching beacons for building: {} and floor: {}", buildingId, floorId);
        return beaconRepository.findByBuildingIdAndFloorId(buildingId, floorId);
    }

    /**
     * Get beacon by ID
     */
    public Optional<Beacon> getBeacon(String id) {
        log.info("Fetching beacon with ID: {}", id);
        return beaconRepository.findById(id);
    }

    /**
     * Create a new beacon
     */
    public Beacon createBeacon(CreateBeaconRequest request) {
        log.info("Creating beacon: UUID={}, major={}, minor={} in floor: {}", 
            request.getUuid(), request.getMajor(), request.getMinor(), request.getFloorId());

        // Validate required fields
        if (request.getBuildingId() == null || request.getBuildingId().isEmpty()) {
            throw new IllegalArgumentException("Building ID is required");
        }
        if (request.getFloorId() == null || request.getFloorId().isEmpty()) {
            throw new IllegalArgumentException("Floor ID is required");
        }
        if (request.getUuid() == null || request.getUuid().isEmpty()) {
            throw new IllegalArgumentException("UUID is required");
        }
        if (request.getMajor() == null || request.getMinor() == null) {
            throw new IllegalArgumentException("Major and minor are required");
        }
        if (request.getMajor() < 0 || request.getMinor() < 0) {
            throw new IllegalArgumentException("Major and minor must be non-negative");
        }

        String uuid = request.getUuid().toUpperCase();
        if (beaconRepository.findByUuidAndMajorAndMinor(uuid, request.getMajor(), request.getMinor()).isPresent()) {
            throw new IllegalArgumentException("Beacon with UUID=" + uuid + ", major=" + request.getMajor() 
                + ", minor=" + request.getMinor() + " already exists");
        }

        Beacon beacon = new Beacon(
            request.getBuildingId(),
            request.getFloorId(),
            uuid,
            request.getMajor(),
            request.getMinor(),
            request.getX(),
            request.getY()
        );

        if (request.getLabel() != null && !request.getLabel().isEmpty()) {
            beacon.setLabel(request.getLabel());
        }

        if (request.getTxPower() != null) {
            beacon.setTxPower(request.getTxPower());
        }

        beacon.setCreatedAt(LocalDateTime.now());
        Beacon saved = beaconRepository.save(beacon);
        log.info("Beacon created successfully with ID: {}", saved.getId());
        return saved;
    }

    /**
     * Update an existing beacon
     */
    public Optional<Beacon> updateBeacon(String id, CreateBeaconRequest request) {
        log.info("Updating beacon with ID: {}", id);

        return beaconRepository.findById(id).map(beacon -> {
            if (request.getUuid() != null && !request.getUuid().isEmpty()) {
                beacon.setUuid(request.getUuid().toUpperCase());
            }
            if (request.getMajor() != null && request.getMajor() >= 0) {
                beacon.setMajor(request.getMajor());
            }
            if (request.getMinor() != null && request.getMinor() >= 0) {
                beacon.setMinor(request.getMinor());
            }
            if (request.getX() > 0) {
                beacon.setX(request.getX());
            }
            if (request.getY() > 0) {
                beacon.setY(request.getY());
            }
            if (request.getLabel() != null) {
                beacon.setLabel(request.getLabel());
            }
            if (request.getTxPower() != null) {
                beacon.setTxPower(request.getTxPower());
            }

            Beacon saved = beaconRepository.save(beacon);
            log.info("Beacon updated successfully");
            return saved;
        });
    }

    /**
     * Delete a beacon
     */
    public boolean deleteBeacon(String id) {
        log.info("Deleting beacon with ID: {}", id);

        if (beaconRepository.existsById(id)) {
            beaconRepository.deleteById(id);
            log.info("Beacon deleted successfully");
            return true;
        }
        log.warn("Beacon with ID {} not found", id);
        return false;
    }
}
