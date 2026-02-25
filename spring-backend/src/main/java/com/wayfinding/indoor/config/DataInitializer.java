package com.wayfinding.indoor.config;

import com.wayfinding.indoor.model.*;
import com.wayfinding.indoor.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final BuildingRepository buildingRepository;
    private final FloorRepository floorRepository;
    private final BeaconRepository beaconRepository;
    private final POIRepository poiRepository;

    @Override
    public void run(String... args) throws Exception {
        // Only initialize if database is empty
        if (buildingRepository.count() > 0) {
            log.info("Database already has data, skipping initialization");
            return;
        }

        log.info("Initializing database with sample data...");

        // Create a sample building
        Building building = new Building(
                "BLD-DEMO",
                "Demo Office Building",
                "A sample office building for indoor navigation demo",
                "123 Main Street",
                2
        );
        building = buildingRepository.save(building);
        log.info("Created building: {}", building.getId());

        // Create a sample floor (1000x800 pixel map, origin at top-left)
        String floorId = "FLR-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        Floor floor = new Floor(
                floorId,
                building.getId(),
                1,
                "Ground Floor",
                1000,  // width in pixels
                800,   // height in pixels
                10.0   // 10 pixels per meter
        );
        floor = floorRepository.save(floor);
        log.info("Created floor: {}", floor.getId());

        String sampleUuid = "00010203-0405-0607-0809-0a0b0c0d0e0f";

        Beacon beacon1 = new Beacon(
                building.getId(),
                floor.getId(),
                sampleUuid,
                1,     // major
                1,     // minor
                150,   // x position
                150    // y position
        );
        beacon1.setLabel("Entrance Beacon");
        beaconRepository.save(beacon1);

        Beacon beacon2 = new Beacon(
                building.getId(),
                floor.getId(),
                sampleUuid,
                1,     // major
                2,     // minor
                500,   // x position
                400    // y position
        );
        beacon2.setLabel("Center Beacon");
        beaconRepository.save(beacon2);

        Beacon beacon3 = new Beacon(
                building.getId(),
                floor.getId(),
                sampleUuid,
                1,     // major
                3,     // minor
                850,   // x position
                650    // y position
        );
        beacon3.setLabel("Exit Beacon");
        beaconRepository.save(beacon3);

        log.info("Created 3 sample beacons");

        // Create sample POIs (destinations)
        POI entrance = new POI(
                building.getId(),
                floor.getId(),
                "Main Entrance",
                "entrance",
                100,
                100
        );
        entrance.setDescription("Main building entrance");
        poiRepository.save(entrance);

        POI reception = new POI(
                building.getId(),
                floor.getId(),
                "Reception Desk",
                "room",
                300,
                200
        );
        reception.setDescription("Welcome desk and visitor registration");
        poiRepository.save(reception);

        POI conferenceRoom = new POI(
                building.getId(),
                floor.getId(),
                "Conference Room A",
                "room",
                700,
                300
        );
        conferenceRoom.setDescription("Large meeting room with video conferencing");
        poiRepository.save(conferenceRoom);

        POI restroom = new POI(
                building.getId(),
                floor.getId(),
                "Restroom",
                "restroom",
                900,
                500
        );
        poiRepository.save(restroom);

        POI elevator = new POI(
                building.getId(),
                floor.getId(),
                "Elevator",
                "elevator",
                500,
                600
        );
        poiRepository.save(elevator);

        log.info("Created 5 sample POIs");
        log.info("Database initialization complete!");
        log.info("\n=== Test Data Summary ===");
        log.info("Building ID: {}", building.getId());
        log.info("Floor ID: {}", floor.getId());
        log.info("Beacon UUID: {}", sampleUuid);
        log.info("Beacon Major: 1, Minors: 1, 2, 3");
        log.info("========================\n");
    }
}
