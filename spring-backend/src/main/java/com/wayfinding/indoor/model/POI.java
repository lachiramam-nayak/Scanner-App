package com.wayfinding.indoor.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "pois")
public class POI {
    @Id
    private String id;
    
    @Indexed
    private String buildingId;
    
    @Indexed
    private String floorId;
    
    private String name;
    private String category; // room, elevator, stairs, restroom, exit, office, etc.
    private double x;
    private double y;
    private String description;
    private LocalDateTime createdAt;

    public POI(String buildingId, String floorId, String name, String category, double x, double y) {
        this.buildingId = buildingId;
        this.floorId = floorId;
        this.name = name;
        this.category = category;
        this.x = x;
        this.y = y;
        this.createdAt = LocalDateTime.now();
    }
}
