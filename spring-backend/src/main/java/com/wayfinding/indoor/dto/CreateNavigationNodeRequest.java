package com.wayfinding.indoor.dto;

import lombok.Data;

import java.util.List;

@Data
public class CreateNavigationNodeRequest {
    private String floorId;
    private Double x;
    private Double y;
    private List<String> connectedNodes;
    private String poiId;
    private String nodeType;
}
