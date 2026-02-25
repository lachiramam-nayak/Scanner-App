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
@Document(collection = "floors")
public class Floor {
    @Id
    private String id;
    
    @Indexed(unique = true)
    private String floorId;
    
    @Indexed
    private String buildingId;
    
    private int floorNumber;
    private String name;
    private int width;  // Map width in pixels/units
    private int height; // Map height in pixels/units
    private double scale; // Scale factor (pixels per meter)
    private String mapImage; // Base64 encoded map image
    private String mapImageUrl; // URL to static map: /maps/{buildingId}/{floorId}.png
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Floor(String floorId, String buildingId, int floorNumber, String name, int width, int height, double scale) {
        this.floorId = floorId;
        this.buildingId = buildingId;
        this.floorNumber = floorNumber;
        this.name = name;
        this.width = width;
        this.height = height;
        this.scale = scale;
        this.mapImageUrl = "/maps/" + buildingId + "/" + floorId + ".png";
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
}
