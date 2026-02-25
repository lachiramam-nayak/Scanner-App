package com.wayfinding.indoor.service;

import com.wayfinding.indoor.dto.BeaconScanRequest;
import com.wayfinding.indoor.dto.PositionResponse;
import com.wayfinding.indoor.model.Beacon;
import com.wayfinding.indoor.model.Building;
import com.wayfinding.indoor.model.Floor;
import com.wayfinding.indoor.repository.BeaconRepository;
import com.wayfinding.indoor.repository.BuildingRepository;
import com.wayfinding.indoor.repository.FloorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PositioningService {

    private final BeaconRepository beaconRepository;
    private final FloorRepository floorRepository;
    private final BuildingRepository buildingRepository;

    /**
     * Compute user position from scanned beacons using iBeacon UUID+Major+Minor matching.
     * Uses trilateration when 3+ beacons are available; otherwise falls back to weighted/nearest.
     * This method ignores MAC addresses and matches only on UUID/Major/Minor.
     */
    public PositionResponse computePosition(BeaconScanRequest request) {
        if (request.getBeacons() == null || request.getBeacons().isEmpty()) {
            return PositionResponse.builder()
                    .valid(false)
                    .errorMessage("No beacons provided")
                    .build();
        }

        // Match scanned beacons to registered beacons in database (UUID+Major+Minor only)
        List<MatchedBeacon> matchedBeacons = new ArrayList<>();
        
        for (BeaconScanRequest.ScannedBeacon scanned : request.getBeacons()) {
            // Filter out weak signals (backend side safety): ignore RSSI below -75 dBm
            if (scanned.getRssi() < -75) {
                continue;
            }

            // Match by UUID+Major+Minor (preferred). Do NOT use MAC addresses.
            Optional<Beacon> registered = Optional.empty();
            if (scanned.getUuid() != null && !scanned.getUuid().trim().isEmpty()) {
                String uuid = scanned.getUuid().trim();
                Integer major = scanned.getMajor();
                Integer minor = scanned.getMinor();

                if (major != null && minor != null) {
                    String upper = uuid.toUpperCase();
                    String lower = uuid.toLowerCase();
                    registered = beaconRepository.findByUuidAndMajorAndMinor(upper, major, minor);
                    if (registered.isEmpty() && !lower.equals(upper)) {
                        registered = beaconRepository.findByUuidAndMajorAndMinor(lower, major, minor);
                    }
                }
            }

            if (registered.isPresent()) {
                matchedBeacons.add(new MatchedBeacon(registered.get(), scanned.getRssi()));
            }
        }

        if (matchedBeacons.isEmpty()) {
            return PositionResponse.builder()
                    .valid(false)
                    .errorMessage("No registered beacons found")
                    .build();
        }

        // Group by floor and pick best floor by strongest combined RSSI
        String bestFloorId = null;
        double bestFloorScore = Double.NEGATIVE_INFINITY;
        java.util.Map<String, Double> floorScores = new java.util.HashMap<>();
        for (MatchedBeacon mb : matchedBeacons) {
            String floorId = mb.beacon.getFloorId();
            floorScores.put(floorId, floorScores.getOrDefault(floorId, 0.0) + mb.rssi);
        }
        for (java.util.Map.Entry<String, Double> entry : floorScores.entrySet()) {
            if (entry.getValue() > bestFloorScore) {
                bestFloorScore = entry.getValue();
                bestFloorId = entry.getKey();
            }
        }

        final String bestFloor = bestFloorId;
        List<MatchedBeacon> floorBeacons = matchedBeacons.stream()
                .filter(mb -> mb.beacon.getFloorId().equals(bestFloor))
                .collect(Collectors.toList());

        String method;
        double[] position;
        if (floorBeacons.size() >= 3) {
            position = computeTrilaterationPosition(floorBeacons);
            method = "trilateration";
        } else if (floorBeacons.size() == 1) {
            Beacon b = floorBeacons.get(0).beacon;
            position = new double[]{b.getX(), b.getY()};
            method = "nearest";
        } else {
            position = computeWeightedPosition(floorBeacons);
            method = "weighted";
        }

        // Get floor and building info
        Optional<Floor> floorOpt = floorRepository.findById(bestFloorId);
        if (floorOpt.isEmpty()) {
            return PositionResponse.builder()
                    .valid(false)
                    .errorMessage("Floor not found")
                    .build();
        }

        Floor floor = floorOpt.get();
        Optional<Building> buildingOpt = buildingRepository.findById(floor.getBuildingId());

        return PositionResponse.builder()
                .valid(true)
                .buildingId(floor.getBuildingId())
                .buildingName(buildingOpt.map(Building::getName).orElse("Unknown"))
                .floorId(floor.getId())
                .floorName(floor.getName())
                .floorNumber(floor.getFloorNumber())
                .x(position[0])
                .y(position[1])
                .method(method)
                .beaconsUsed(floorBeacons.size())
                .build();
    }

    private double[] computeWeightedPosition(List<MatchedBeacon> beacons) {
        if (beacons.isEmpty()) {
            return new double[]{0, 0};
        }
        if (beacons.size() == 1) {
            Beacon b = beacons.get(0).beacon;
            return new double[]{b.getX(), b.getY()};
        }

        double totalWeight = 0;
        double weightedX = 0;
        double weightedY = 0;

        for (MatchedBeacon mb : beacons) {
            double weight = Math.pow(10, (100 + mb.rssi) / 40.0);
            weightedX += mb.beacon.getX() * weight;
            weightedY += mb.beacon.getY() * weight;
            totalWeight += weight;
        }

        if (totalWeight == 0) {
            return new double[]{
                    beacons.stream().mapToDouble(mb -> mb.beacon.getX()).average().orElse(0),
                    beacons.stream().mapToDouble(mb -> mb.beacon.getY()).average().orElse(0)
            };
        }

        return new double[]{weightedX / totalWeight, weightedY / totalWeight};
    }

    private double[] computeTrilaterationPosition(List<MatchedBeacon> beacons) {
        List<MatchedBeacon> top = beacons.stream()
                .sorted(Comparator.comparingInt((MatchedBeacon b) -> b.rssi).reversed())
                .limit(3)
                .collect(Collectors.toList());

        MatchedBeacon b1 = top.get(0);
        MatchedBeacon b2 = top.get(1);
        MatchedBeacon b3 = top.get(2);

        double x1 = b1.beacon.getX();
        double y1 = b1.beacon.getY();
        double x2 = b2.beacon.getX();
        double y2 = b2.beacon.getY();
        double x3 = b3.beacon.getX();
        double y3 = b3.beacon.getY();

        double d1 = rssiToDistance(b1.rssi, b1.beacon.getTxPower());
        double d2 = rssiToDistance(b2.rssi, b2.beacon.getTxPower());
        double d3 = rssiToDistance(b3.rssi, b3.beacon.getTxPower());

        double A = 2 * (x2 - x1);
        double B = 2 * (y2 - y1);
        double C = d1 * d1 - d2 * d2 - x1 * x1 + x2 * x2 - y1 * y1 + y2 * y2;

        double D = 2 * (x3 - x1);
        double E = 2 * (y3 - y1);
        double F = d1 * d1 - d3 * d3 - x1 * x1 + x3 * x3 - y1 * y1 + y3 * y3;

        double denom = (A * E - B * D);
        if (Math.abs(denom) < 1e-6) {
            return computeWeightedPosition(beacons);
        }

        double x = (C * E - B * F) / denom;
        double y = (A * F - C * D) / denom;

        if (Double.isNaN(x) || Double.isNaN(y) || Double.isInfinite(x) || Double.isInfinite(y)) {
            return computeWeightedPosition(beacons);
        }

        return new double[]{x, y};
    }

    private double rssiToDistance(int rssi, double txPower) {
        double n = 2.0;
        if (txPower == 0) {
            txPower = -59;
        }
        return Math.pow(10.0, (txPower - rssi) / (10.0 * n));
    }

    /**
     * Helper class to hold a matched beacon with its RSSI
     */
    private static class MatchedBeacon {
        final Beacon beacon;
        final int rssi;

        MatchedBeacon(Beacon beacon, int rssi) {
            this.beacon = beacon;
            this.rssi = rssi;
        }
    }
}
