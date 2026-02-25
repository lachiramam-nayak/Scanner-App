package com.wayfinding.indoor.controller;

import com.wayfinding.indoor.dto.CreateEdgeRequest;
import com.wayfinding.indoor.model.GraphEdge;
import com.wayfinding.indoor.service.GraphEdgeService;
import com.wayfinding.indoor.util.EdgeCsvImporter;
import com.wayfinding.indoor.util.EdgeCsvImporter.EdgePair;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/edges")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Edges", description = "Navigation graph edges")
public class EdgeController {

    private final GraphEdgeService edgeService;

    @PostMapping
    @Operation(summary = "Create edge")
    public ResponseEntity<GraphEdge> createEdge(@RequestBody CreateEdgeRequest request) {
        GraphEdge saved = edgeService.createEdge(request);
        log.info("POST /api/edges - Created edge {}", saved.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PostMapping("/bulk")
    @Operation(summary = "Create edges in bulk")
    public ResponseEntity<List<GraphEdge>> createEdges(@RequestBody List<CreateEdgeRequest> requests) {
        List<GraphEdge> saved = edgeService.createEdges(requests);
        log.info("POST /api/edges/bulk - Created {} edges", saved.size());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PostMapping(value = "/import-csv", consumes = "text/csv")
    @Operation(summary = "Import edges from CSV (fromNodeId,toNodeId)")
    public ResponseEntity<List<GraphEdge>> importCsv(
            @RequestParam String buildingId,
            @RequestParam String floorId,
            @RequestBody String csv
    ) {
        List<EdgePair> pairs = EdgeCsvImporter.parseCsv(csv);
        List<CreateEdgeRequest> requests = pairs.stream().map(p -> {
            CreateEdgeRequest req = new CreateEdgeRequest();
            req.setFromNodeId(p.fromNodeId());
            req.setToNodeId(p.toNodeId());
            req.setBuildingId(buildingId);
            req.setFloorId(floorId);
            return req;
        }).collect(Collectors.toList());

        List<GraphEdge> saved = edgeService.createEdges(requests);
        log.info("POST /api/edges/import-csv - Created {} edges", saved.size());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping
    @Operation(summary = "List edges by building/floor")
    public ResponseEntity<List<GraphEdge>> listEdges(
            @RequestParam(required = false) String buildingId,
            @RequestParam(required = false) String floorId
    ) {
        return ResponseEntity.ok(edgeService.listEdges(buildingId, floorId));
    }

    @DeleteMapping("/{edgeId}")
    @Operation(summary = "Delete edge by edgeId")
    public ResponseEntity<Void> deleteEdge(@PathVariable String edgeId) {
        edgeService.deleteById(edgeId);
        log.info("DELETE /api/edges/{} - Deleted edge", edgeId);
        return ResponseEntity.noContent().build();
    }
}
