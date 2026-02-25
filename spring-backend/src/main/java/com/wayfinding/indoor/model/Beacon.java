package com.wayfinding.indoor.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.CompoundIndex;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "beacons")
@CompoundIndex(name = "beacon_uuid_major_minor", def = "{'uuid': 1, 'major': 1, 'minor': 1}", unique = true)
public class Beacon {
    @Id
    private String id;
    
    private String buildingId;
    private String floorId;
    
    // iBeacon fields (UUID + Major + Minor)
    private String uuid; // e.g., "00010203-0405-0607-0809-0a0b0c0d0e0f"
    private Integer major;
    private Integer minor;
    
    // Position on the floor map (0,0 is top-left)
    private double x;
    private double y;
    
    // Optional metadata
    private String label;
    private double txPower; // Transmission power for RSSI calibration
    
    private LocalDateTime createdAt;

    public Beacon(String buildingId, String floorId, String uuid, int major, int minor, double x, double y) {
        this.buildingId = buildingId;
        this.floorId = floorId;
        this.uuid = uuid != null ? uuid.toUpperCase() : null;
        this.major = major;
        this.minor = minor;
        this.x = x;
        this.y = y;
        this.txPower = -59; // Default txPower at 1m
        this.createdAt = LocalDateTime.now();
    }
}
