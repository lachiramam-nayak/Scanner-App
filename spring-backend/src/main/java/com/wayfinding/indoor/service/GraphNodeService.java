package com.wayfinding.indoor.service;

import com.wayfinding.indoor.dto.CreateNodeRequest;
import com.wayfinding.indoor.model.GraphNode;
import com.wayfinding.indoor.repository.GraphNodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class GraphNodeService {

    private final GraphNodeRepository nodeRepository;

    public GraphNode createNode(CreateNodeRequest request) {
        if (request.getNodeId() == null || request.getNodeId().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "nodeId is required");
        }
        if (request.getBuildingId() == null || request.getBuildingId().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "buildingId is required");
        }
        if (request.getFloorId() == null || request.getFloorId().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "floorId is required");
        }
        if (request.getX() == null || request.getY() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "x and y are required");
        }

        nodeRepository.findByNodeIdAndBuildingIdAndFloorId(
                request.getNodeId(),
                request.getBuildingId(),
                request.getFloorId()
        ).ifPresent(n -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "nodeId already exists");
        });

        GraphNode node = new GraphNode();
        node.setNodeId(request.getNodeId());
        node.setBuildingId(request.getBuildingId());
        node.setFloorId(request.getFloorId());
        node.setX(request.getX());
        node.setY(request.getY());
        return nodeRepository.save(node);
    }

    public List<GraphNode> createNodes(List<CreateNodeRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "nodes list is required");
        }
        for (CreateNodeRequest request : requests) {
            if (request.getNodeId() == null || request.getNodeId().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "nodeId is required");
            }
            if (request.getBuildingId() == null || request.getBuildingId().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "buildingId is required");
            }
            if (request.getFloorId() == null || request.getFloorId().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "floorId is required");
            }
            if (request.getX() == null || request.getY() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "x and y are required");
            }
        }

        return nodeRepository.saveAll(
                requests.stream().map(req -> {
                    GraphNode node = new GraphNode();
                    node.setNodeId(req.getNodeId());
                    node.setBuildingId(req.getBuildingId());
                    node.setFloorId(req.getFloorId());
                    node.setX(req.getX());
                    node.setY(req.getY());
                    return node;
                }).toList()
        );
    }

    public List<GraphNode> listNodes(String buildingId, String floorId) {
        if (buildingId != null && floorId != null) {
            return nodeRepository.findByBuildingIdAndFloorId(buildingId, floorId);
        }
        return nodeRepository.findAll();
    }

    public void deleteByNodeId(String nodeId) {
        long deleted = nodeRepository.deleteByNodeId(nodeId);
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "nodeId not found");
        }
    }

    public void deleteByBuildingAndFloor(String buildingId, String floorId) {
        long deleted = nodeRepository.deleteByBuildingIdAndFloorId(buildingId, floorId);
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No nodes found for building/floor");
        }
    }
}
