package com.wayfinding.indoor.dto;

import lombok.Data;

@Data
public class CreateBuildingRequest {
    private String buildingId;
    private String name;
    private String description;
    private String address;
    private int totalFloors;
}
