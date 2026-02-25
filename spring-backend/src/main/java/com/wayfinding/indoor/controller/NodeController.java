package com.wayfinding.indoor.controller;

import com.wayfinding.indoor.dto.CreateNodeRequest;
import com.wayfinding.indoor.model.GraphNode;
import com.wayfinding.indoor.service.GraphNodeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/nodes")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Nodes", description = "Navigation graph nodes")
public class NodeController {

    private final GraphNodeService nodeService;

    @PostMapping
    @Operation(summary = "Create node")
    public ResponseEntity<GraphNode> createNode(@RequestBody CreateNodeRequest request) {
        GraphNode saved = nodeService.createNode(request);
        log.info("POST /api/nodes - Created node {}", saved.getNodeId());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PostMapping("/bulk")
    @Operation(summary = "Create nodes in bulk")
    public ResponseEntity<List<GraphNode>> createNodes(@RequestBody List<CreateNodeRequest> requests) {
        List<GraphNode> saved = nodeService.createNodes(requests);
        log.info("POST /api/nodes/bulk - Created {} nodes", saved.size());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping
    @Operation(summary = "List nodes by building/floor")
    public ResponseEntity<List<GraphNode>> listNodes(
            @RequestParam(required = false) String buildingId,
            @RequestParam(required = false) String floorId
    ) {
        return ResponseEntity.ok(nodeService.listNodes(buildingId, floorId));
    }

    @DeleteMapping("/{nodeId}")
    @Operation(summary = "Delete node by nodeId")
    public ResponseEntity<Void> deleteNode(@PathVariable String nodeId) {
        nodeService.deleteByNodeId(nodeId);
        log.info("DELETE /api/nodes/{} - Deleted node", nodeId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    @Operation(summary = "Delete nodes by buildingId and floorId")
    public ResponseEntity<Void> deleteByBuildingAndFloor(
            @RequestParam String buildingId,
            @RequestParam String floorId
    ) {
        nodeService.deleteByBuildingAndFloor(buildingId, floorId);
        log.info("DELETE /api/nodes?buildingId={}&floorId={} - Deleted nodes", buildingId, floorId);
        return ResponseEntity.noContent().build();
    }
}
