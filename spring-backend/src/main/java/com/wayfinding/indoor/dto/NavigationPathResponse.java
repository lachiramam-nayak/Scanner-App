package com.wayfinding.indoor.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Navigation path response")
public class NavigationPathResponse {
    @Schema(description = "Ordered path points from start to destination")
    private List<PathPoint> path;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Path point with coordinates")
    public static class PathPoint {
        @Schema(example = "105")
        private double x;

        @Schema(example = "85")
        private double y;
    }
}
