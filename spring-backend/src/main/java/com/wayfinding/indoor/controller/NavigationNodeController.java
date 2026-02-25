package com.wayfinding.indoor.controller;

import com.wayfinding.indoor.dto.CreateNavigationNodeRequest;
import com.wayfinding.indoor.model.NavigationNode;
import com.wayfinding.indoor.repository.NavigationNodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/navigation-nodes")
@RequiredArgsConstructor
@Slf4j
public class NavigationNodeController {

    private final NavigationNodeRepository nodeRepository;

    @GetMapping
    public ResponseEntity<List<NavigationNode>> getAllNodes(
            @RequestParam(required = false) String floor_id) {
        if (floor_id != null && !floor_id.isEmpty()) {
            log.info("GET /api/navigation-nodes?floor_id={} - Fetching nodes for floor", floor_id);
            return ResponseEntity.ok(nodeRepository.findByFloorId(floor_id));
        }
        log.info("GET /api/navigation-nodes - Fetching all nodes");
        return ResponseEntity.ok(nodeRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<NavigationNode> getNode(@PathVariable String id) {
        log.info("GET /api/navigation-nodes/{} - Fetching node by ID", id);
        return nodeRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<NavigationNode> createNode(@RequestBody CreateNavigationNodeRequest request) {
        if (request.getFloorId() == null || request.getFloorId().trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        if (request.getX() == null || request.getY() == null) {
            return ResponseEntity.badRequest().build();
        }

        NavigationNode node = new NavigationNode();
        node.setFloorId(request.getFloorId());
        node.setX(request.getX());
        node.setY(request.getY());
        node.setConnectedNodes(request.getConnectedNodes());
        node.setPoiId(request.getPoiId());
        node.setNodeType(request.getNodeType());

        NavigationNode saved = nodeRepository.save(node);
        log.info("POST /api/navigation-nodes - Created node {}", saved.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PostMapping("/bulk")
    public ResponseEntity<List<NavigationNode>> createNodes(@RequestBody List<CreateNavigationNodeRequest> requests) {
        List<NavigationNode> nodes = new ArrayList<>();
        for (CreateNavigationNodeRequest request : requests) {
            if (request.getFloorId() == null || request.getFloorId().trim().isEmpty()) {
                continue;
            }
            if (request.getX() == null || request.getY() == null) {
                continue;
            }
            NavigationNode node = new NavigationNode();
            node.setFloorId(request.getFloorId());
            node.setX(request.getX());
            node.setY(request.getY());
            node.setConnectedNodes(request.getConnectedNodes());
            node.setPoiId(request.getPoiId());
            node.setNodeType(request.getNodeType());
            nodes.add(node);
        }

        List<NavigationNode> saved = nodeRepository.saveAll(nodes);
        log.info("POST /api/navigation-nodes/bulk - Created {} nodes", saved.size());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<NavigationNode> updateNode(
            @PathVariable String id,
            @RequestBody CreateNavigationNodeRequest request) {
        return nodeRepository.findById(id)
                .map(existing -> {
                    if (request.getFloorId() != null) existing.setFloorId(request.getFloorId());
                    if (request.getX() != null) existing.setX(request.getX());
                    if (request.getY() != null) existing.setY(request.getY());
                    if (request.getConnectedNodes() != null) existing.setConnectedNodes(request.getConnectedNodes());
                    if (request.getPoiId() != null) existing.setPoiId(request.getPoiId());
                    if (request.getNodeType() != null) existing.setNodeType(request.getNodeType());
                    NavigationNode saved = nodeRepository.save(existing);
                    log.info("PUT /api/navigation-nodes/{} - Updated node", id);
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/connections")
    public ResponseEntity<NavigationNode> updateConnections(
            @PathVariable String id,
            @RequestBody List<String> connectedNodes) {
        return nodeRepository.findById(id)
                .map(existing -> {
                    existing.setConnectedNodes(connectedNodes);
                    NavigationNode saved = nodeRepository.save(existing);
                    log.info("PUT /api/navigation-nodes/{}/connections - Updated connections", id);
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/floor/{floorId}")
    public ResponseEntity<Void> deleteByFloor(@PathVariable String floorId) {
        long deleted = nodeRepository.deleteByFloorId(floorId);
        log.info("DELETE /api/navigation-nodes/floor/{} - Deleted {} nodes", floorId, deleted);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNode(@PathVariable String id) {
        if (!nodeRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        nodeRepository.deleteById(id);
        log.info("DELETE /api/navigation-nodes/{} - Deleted node", id);
        return ResponseEntity.noContent().build();
    }
}
