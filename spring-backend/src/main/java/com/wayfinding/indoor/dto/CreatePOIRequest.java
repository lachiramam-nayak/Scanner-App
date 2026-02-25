package com.wayfinding.indoor.dto;

import lombok.Data;

@Data
public class CreatePOIRequest {
    private String buildingId;
    private String floorId;
    private String name;
    private String category;
    private double x;
    private double y;
    private String description;
}
