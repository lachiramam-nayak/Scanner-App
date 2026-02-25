package com.wayfinding.indoor.service;

import com.wayfinding.indoor.dto.CreateEdgeRequest;
import com.wayfinding.indoor.model.GraphEdge;
import com.wayfinding.indoor.model.GraphNode;
import com.wayfinding.indoor.repository.GraphEdgeRepository;
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
public class GraphEdgeService {

    private final GraphEdgeRepository edgeRepository;
    private final GraphNodeRepository nodeRepository;

    public GraphEdge createEdge(CreateEdgeRequest request) {
        if (request.getFromNodeId() == null || request.getFromNodeId().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fromNodeId is required");
        }
        if (request.getToNodeId() == null || request.getToNodeId().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "toNodeId is required");
        }
        if (request.getBuildingId() == null || request.getBuildingId().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "buildingId is required");
        }
        if (request.getFloorId() == null || request.getFloorId().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "floorId is required");
        }

        GraphNode from = nodeRepository.findByNodeIdAndBuildingIdAndFloorId(
                request.getFromNodeId(),
                request.getBuildingId(),
                request.getFloorId()
        )
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "fromNodeId not found"));
        GraphNode to = nodeRepository.findByNodeIdAndBuildingIdAndFloorId(
                request.getToNodeId(),
                request.getBuildingId(),
                request.getFloorId()
        )
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "toNodeId not found"));

        double weight = distance(from.getX(), from.getY(), to.getX(), to.getY());

        GraphEdge edge = new GraphEdge();
        edge.setFromNodeId(request.getFromNodeId());
        edge.setToNodeId(request.getToNodeId());
        edge.setBuildingId(request.getBuildingId());
        edge.setFloorId(request.getFloorId());
        edge.setWeight(weight);
        return edgeRepository.save(edge);
    }

    public List<GraphEdge> createEdges(List<CreateEdgeRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "edges list is required");
        }
        List<GraphEdge> edges = new java.util.ArrayList<>();
        for (CreateEdgeRequest request : requests) {
            edges.add(createEdge(request));
        }
        return edges;
    }

    public List<GraphEdge> listEdges(String buildingId, String floorId) {
        if (buildingId != null && floorId != null) {
            return edgeRepository.findByBuildingIdAndFloorId(buildingId, floorId);
        }
        return edgeRepository.findAll();
    }

    public void deleteById(String edgeId) {
        if (!edgeRepository.existsById(edgeId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "edge not found");
        }
        edgeRepository.deleteById(edgeId);
    }

    double distance(double x1, double y1, double x2, double y2) {
        double dx = x2 - x1;
        double dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
