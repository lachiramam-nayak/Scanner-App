package com.wayfinding.indoor.dto;

import lombok.Data;

@Data
public class NavigationRequest {
    private String floorId;
    private double startX;
    private double startY;
    private double destX;
    private double destY;
}
