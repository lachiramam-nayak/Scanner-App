package com.wayfinding.indoor.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "Create a navigation graph edge")
public class CreateEdgeRequest {
    @Schema(example = "n1")
    private String fromNodeId;

    @Schema(example = "n2")
    private String toNodeId;

    @Schema(example = "building-123")
    private String buildingId;

    @Schema(example = "floor-1")
    private String floorId;
}
