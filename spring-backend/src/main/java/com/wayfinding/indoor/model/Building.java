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
@Document(collection = "buildings")
public class Building {
    @Id
    private String id;
    
    @Indexed(unique = true)
    private String buildingId;
    
    private String name;
    private String description;
    private String address;
    private int totalFloors;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Building(String buildingId, String name, String description, String address, int totalFloors) {
        this.buildingId = buildingId;
        this.name = name;
        this.description = description;
        this.address = address;
        this.totalFloors = totalFloors;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
}
