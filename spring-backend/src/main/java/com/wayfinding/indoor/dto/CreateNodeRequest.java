package com.wayfinding.indoor.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "Create a navigation graph node")
public class CreateNodeRequest {
    @Schema(example = "n1")
    private String nodeId;

    @Schema(example = "building-123")
    private String buildingId;

    @Schema(example = "floor-1")
    private String floorId;

    @Schema(example = "105")
    private Double x;

    @Schema(example = "85")
    private Double y;
}
