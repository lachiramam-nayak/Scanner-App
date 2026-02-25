package com.wayfinding.indoor.service;

import com.wayfinding.indoor.dto.NavigationPathResponse;
import com.wayfinding.indoor.model.GraphEdge;
import com.wayfinding.indoor.model.GraphNode;
import com.wayfinding.indoor.repository.GraphEdgeRepository;
import com.wayfinding.indoor.repository.GraphNodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class GraphNavigationService {

    private final GraphNodeRepository nodeRepository;
    private final GraphEdgeRepository edgeRepository;

    public NavigationPathResponse computePath(String buildingId, String floorId,
                                              double fromX, double fromY,
                                              double toX, double toY) {
        List<GraphNode> nodes = nodeRepository.findByBuildingIdAndFloorId(buildingId, floorId);
        if (nodes.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No nodes found for building/floor");
        }

        GraphNode startNode = findNearestNode(nodes, fromX, fromY);
        GraphNode endNode = findNearestNode(nodes, toX, toY);

        if (startNode == null || endNode == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unable to find nearest nodes");
        }

        List<GraphEdge> edges = edgeRepository.findByBuildingIdAndFloorId(buildingId, floorId);
        if (edges.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No edges found for building/floor");
        }

        List<String> nodePath = computeShortestPath(nodes, edges, startNode.getNodeId(), endNode.getNodeId());
        if (nodePath.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No path found between nodes");
        }

        Map<String, GraphNode> nodeMap = new HashMap<>();
        for (GraphNode node : nodes) {
            nodeMap.put(node.getNodeId(), node);
        }

        List<NavigationPathResponse.PathPoint> path = new ArrayList<>();
        // Start with actual from point
        path.add(new NavigationPathResponse.PathPoint(fromX, fromY));
        for (String nodeId : nodePath) {
            GraphNode node = nodeMap.get(nodeId);
            if (node != null) {
                path.add(new NavigationPathResponse.PathPoint(node.getX(), node.getY()));
            }
        }
        // End with actual destination
        path.add(new NavigationPathResponse.PathPoint(toX, toY));

        return new NavigationPathResponse(path);
    }

    GraphNode findNearestNode(List<GraphNode> nodes, double x, double y) {
        GraphNode nearest = null;
        double minDist = Double.MAX_VALUE;
        for (GraphNode node : nodes) {
            double dist = distance(node.getX(), node.getY(), x, y);
            if (dist < minDist) {
                minDist = dist;
                nearest = node;
            }
        }
        return nearest;
    }

    List<String> computeShortestPath(List<GraphNode> nodes,
                                     List<GraphEdge> edges,
                                     String startNodeId,
                                     String endNodeId) {
        Map<String, List<Neighbor>> graph = new HashMap<>();
        for (GraphNode node : nodes) {
            graph.put(node.getNodeId(), new ArrayList<>());
        }
        for (GraphEdge edge : edges) {
            if (!graph.containsKey(edge.getFromNodeId()) || !graph.containsKey(edge.getToNodeId())) {
                continue;
            }
            // Treat edges as bidirectional for indoor navigation
            graph.get(edge.getFromNodeId()).add(new Neighbor(edge.getToNodeId(), edge.getWeight()));
            graph.get(edge.getToNodeId()).add(new Neighbor(edge.getFromNodeId(), edge.getWeight()));
        }

        return dijkstra(graph, startNodeId, endNodeId);
    }

    private List<String> dijkstra(Map<String, List<Neighbor>> graph, String start, String end) {
        Map<String, Double> dist = new HashMap<>();
        Map<String, String> prev = new HashMap<>();
        PriorityQueue<NodeDistance> pq = new PriorityQueue<>(Comparator.comparingDouble(n -> n.distance));

        for (String node : graph.keySet()) {
            dist.put(node, Double.MAX_VALUE);
        }
        dist.put(start, 0.0);
        pq.add(new NodeDistance(start, 0.0));

        while (!pq.isEmpty()) {
            NodeDistance current = pq.poll();
            if (current.distance > dist.getOrDefault(current.nodeId, Double.MAX_VALUE)) {
                continue;
            }
            if (current.nodeId.equals(end)) {
                break;
            }
            for (Neighbor neighbor : graph.getOrDefault(current.nodeId, Collections.emptyList())) {
                double alt = current.distance + neighbor.weight;
                if (alt < dist.getOrDefault(neighbor.nodeId, Double.MAX_VALUE)) {
                    dist.put(neighbor.nodeId, alt);
                    prev.put(neighbor.nodeId, current.nodeId);
                    pq.add(new NodeDistance(neighbor.nodeId, alt));
                }
            }
        }

        if (!prev.containsKey(end) && !start.equals(end)) {
            return Collections.emptyList();
        }

        List<String> path = new ArrayList<>();
        String cur = end;
        path.add(cur);
        while (prev.containsKey(cur)) {
            cur = prev.get(cur);
            path.add(cur);
        }
        Collections.reverse(path);
        return path;
    }

    double distance(double x1, double y1, double x2, double y2) {
        double dx = x2 - x1;
        double dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private static class Neighbor {
        final String nodeId;
        final double weight;

        Neighbor(String nodeId, double weight) {
            this.nodeId = nodeId;
            this.weight = weight;
        }
    }

    private static class NodeDistance {
        final String nodeId;
        final double distance;

        NodeDistance(String nodeId, double distance) {
            this.nodeId = nodeId;
            this.distance = distance;
        }
    }
}
