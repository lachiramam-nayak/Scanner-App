package com.wayfinding.indoor.dto;

import lombok.Data;

@Data
public class CreateFloorRequest {
    private String floorId;
    private String buildingId;
    private int floorNumber;
    private String name;
    private int width;
    private int height;
    private double scale;
    private String mapImage;
    private String mapImageUrl;
}
