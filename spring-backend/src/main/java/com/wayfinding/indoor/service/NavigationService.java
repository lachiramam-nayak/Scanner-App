package com.wayfinding.indoor.service;

import com.wayfinding.indoor.dto.NavigationRequest;
import com.wayfinding.indoor.dto.NavigationResponse;
import com.wayfinding.indoor.dto.NavigationResponse.RoutePoint;
import com.wayfinding.indoor.dto.NavigationRecalculateRequest;
import com.wayfinding.indoor.model.NavigationNode;
import com.wayfinding.indoor.repository.NavigationNodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class NavigationService {

    private final NavigationNodeRepository nodeRepository;

    /**
     * Compute navigation route from start to destination.
     * For Phase 1, uses simple direct path or A* if nodes are available.
     */
    public NavigationResponse computeRoute(NavigationRequest request) {
        List<RoutePoint> route = new ArrayList<>();

        // Add start point
        route.add(new RoutePoint(request.getStartX(), request.getStartY(), "start"));

        // Get navigation nodes for this floor
        List<NavigationNode> nodes = nodeRepository.findByFloorId(request.getFloorId());

        if (nodes.isEmpty()) {
            // No navigation graph defined - return direct path
            log.info("No navigation nodes for floor {}, using direct path", request.getFloorId());
            route.add(new RoutePoint(request.getDestX(), request.getDestY(), "destination"));
            
            double distance = calculateDistance(
                    request.getStartX(), request.getStartY(),
                    request.getDestX(), request.getDestY()
            );

            return NavigationResponse.builder()
                    .success(true)
                    .message("Direct path (no navigation graph)")
                    .totalDistance(distance)
                    .route(route)
                    .build();
        }

        // Find path using A* algorithm through navigation nodes
        List<RoutePoint> path = findPath(nodes, 
                request.getStartX(), request.getStartY(),
                request.getDestX(), request.getDestY());

        if (path.isEmpty()) {
            // Fallback to direct path
            route.add(new RoutePoint(request.getDestX(), request.getDestY(), "destination"));
            return NavigationResponse.builder()
                    .success(true)
                    .message("Direct path (no valid route through nodes)")
                    .totalDistance(calculateDistance(
                            request.getStartX(), request.getStartY(),
                            request.getDestX(), request.getDestY()))
                    .route(route)
                    .build();
        }

        route.addAll(path);
        
        // Calculate total distance
        double totalDistance = 0;
        for (int i = 0; i < route.size() - 1; i++) {
            totalDistance += calculateDistance(
                    route.get(i).getX(), route.get(i).getY(),
                    route.get(i + 1).getX(), route.get(i + 1).getY()
            );
        }

        return NavigationResponse.builder()
                .success(true)
                .message("Route calculated successfully")
                .totalDistance(totalDistance)
                .route(route)
                .build();
    }

    /**
     * Recalculate route if user deviates from the previous route beyond a threshold.
     */
    public NavigationResponse recalculateIfDeviated(NavigationRecalculateRequest request) {
        List<NavigationRecalculateRequest.RoutePointInput> prev = request.getPreviousRoute();
        double threshold = request.getDeviationThreshold() != null ? request.getDeviationThreshold() : 50.0;

        if (prev == null || prev.size() < 2) {
            NavigationRequest nav = new NavigationRequest();
            nav.setFloorId(request.getFloorId());
            nav.setStartX(request.getCurrentX());
            nav.setStartY(request.getCurrentY());
            nav.setDestX(request.getDestX());
            nav.setDestY(request.getDestY());
            return computeRoute(nav);
        }

        DeviationResult deviation = computeDeviation(
                request.getCurrentX(),
                request.getCurrentY(),
                prev
        );

        if (deviation.minDistance <= threshold) {
            List<RoutePoint> remaining = buildRemainingRoute(
                    request.getCurrentX(),
                    request.getCurrentY(),
                    prev,
                    deviation.nearestSegmentIndex
            );

            double totalDistance = calculateRouteDistance(remaining);
            return NavigationResponse.builder()
                    .success(true)
                    .message("On route (no recalculation needed)")
                    .totalDistance(totalDistance)
                    .route(remaining)
                    .build();
        }

        NavigationRequest nav = new NavigationRequest();
        nav.setFloorId(request.getFloorId());
        nav.setStartX(request.getCurrentX());
        nav.setStartY(request.getCurrentY());
        nav.setDestX(request.getDestX());
        nav.setDestY(request.getDestY());
        NavigationResponse recalculated = computeRoute(nav);
        recalculated.setMessage("Route recalculated (deviation " + String.format("%.1f", deviation.minDistance) + ")");
        return recalculated;
    }

    /**
     * Simple A* pathfinding through navigation nodes.
     */
    private List<RoutePoint> findPath(List<NavigationNode> nodes,
                                       double startX, double startY,
                                       double destX, double destY) {
        if (nodes.isEmpty()) {
            return Collections.emptyList();
        }

        // Create node map for lookup
        Map<String, NavigationNode> nodeMap = new HashMap<>();
        for (NavigationNode node : nodes) {
            nodeMap.put(node.getId(), node);
        }

        // Find nearest node to start
        NavigationNode startNode = findNearestNode(nodes, startX, startY);
        // Find nearest node to destination
        NavigationNode destNode = findNearestNode(nodes, destX, destY);

        if (startNode == null || destNode == null) {
            return Collections.emptyList();
        }

        // A* algorithm
        PriorityQueue<AStarNode> openSet = new PriorityQueue<>(
                Comparator.comparingDouble(n -> n.fScore)
        );
        Set<String> closedSet = new HashSet<>();
        Map<String, String> cameFrom = new HashMap<>();
        Map<String, Double> gScore = new HashMap<>();

        gScore.put(startNode.getId(), 0.0);
        openSet.add(new AStarNode(startNode.getId(), 
                heuristic(startNode, destNode)));

        while (!openSet.isEmpty()) {
            AStarNode current = openSet.poll();

            if (current.nodeId.equals(destNode.getId())) {
                // Reconstruct path
                return reconstructPath(cameFrom, current.nodeId, nodeMap, destX, destY);
            }

            closedSet.add(current.nodeId);
            NavigationNode currentNode = nodeMap.get(current.nodeId);

            if (currentNode == null || currentNode.getConnectedNodes() == null) {
                continue;
            }

            for (String neighborId : currentNode.getConnectedNodes()) {
                if (closedSet.contains(neighborId)) {
                    continue;
                }

                NavigationNode neighbor = nodeMap.get(neighborId);
                if (neighbor == null) {
                    continue;
                }

                double tentativeG = gScore.getOrDefault(current.nodeId, Double.MAX_VALUE)
                        + calculateDistance(currentNode.getX(), currentNode.getY(),
                        neighbor.getX(), neighbor.getY());

                if (tentativeG < gScore.getOrDefault(neighborId, Double.MAX_VALUE)) {
                    cameFrom.put(neighborId, current.nodeId);
                    gScore.put(neighborId, tentativeG);
                    double fScore = tentativeG + heuristic(neighbor, destNode);
                    openSet.add(new AStarNode(neighborId, fScore));
                }
            }
        }

        return Collections.emptyList();
    }

    private List<RoutePoint> reconstructPath(Map<String, String> cameFrom,
                                              String currentId,
                                              Map<String, NavigationNode> nodeMap,
                                              double destX, double destY) {
        List<RoutePoint> path = new ArrayList<>();
        
        // Build path in reverse
        List<String> nodeIds = new ArrayList<>();
        String id = currentId;
        while (id != null) {
            nodeIds.add(id);
            id = cameFrom.get(id);
        }
        
        // Reverse and convert to RoutePoints
        Collections.reverse(nodeIds);
        for (int i = 0; i < nodeIds.size(); i++) {
            NavigationNode node = nodeMap.get(nodeIds.get(i));
            if (node != null) {
                String type = (i == nodeIds.size() - 1) ? "waypoint" : "waypoint";
                path.add(new RoutePoint(node.getX(), node.getY(), type));
            }
        }
        
        // Add final destination
        path.add(new RoutePoint(destX, destY, "destination"));
        
        return path;
    }

    private NavigationNode findNearestNode(List<NavigationNode> nodes, double x, double y) {
        NavigationNode nearest = null;
        double minDist = Double.MAX_VALUE;
        
        for (NavigationNode node : nodes) {
            double dist = calculateDistance(x, y, node.getX(), node.getY());
            if (dist < minDist) {
                minDist = dist;
                nearest = node;
            }
        }
        
        return nearest;
    }

    private double heuristic(NavigationNode a, NavigationNode b) {
        return calculateDistance(a.getX(), a.getY(), b.getX(), b.getY());
    }

    private double calculateDistance(double x1, double y1, double x2, double y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    private double calculateRouteDistance(List<RoutePoint> route) {
        if (route == null || route.size() < 2) return 0;
        double total = 0;
        for (int i = 0; i < route.size() - 1; i++) {
            total += calculateDistance(
                    route.get(i).getX(), route.get(i).getY(),
                    route.get(i + 1).getX(), route.get(i + 1).getY()
            );
        }
        return total;
    }

    private static class DeviationResult {
        final double minDistance;
        final int nearestSegmentIndex;

        DeviationResult(double minDistance, int nearestSegmentIndex) {
            this.minDistance = minDistance;
            this.nearestSegmentIndex = nearestSegmentIndex;
        }
    }

    private DeviationResult computeDeviation(double x, double y, List<NavigationRecalculateRequest.RoutePointInput> route) {
        double minDist = Double.MAX_VALUE;
        int minIndex = 0;
        for (int i = 0; i < route.size() - 1; i++) {
            double dist = distancePointToSegment(
                    x, y,
                    route.get(i).getX(), route.get(i).getY(),
                    route.get(i + 1).getX(), route.get(i + 1).getY()
            );
            if (dist < minDist) {
                minDist = dist;
                minIndex = i;
            }
        }
        return new DeviationResult(minDist, minIndex);
    }

    private List<RoutePoint> buildRemainingRoute(
            double currentX,
            double currentY,
            List<NavigationRecalculateRequest.RoutePointInput> route,
            int nearestSegmentIndex
    ) {
        List<RoutePoint> remaining = new ArrayList<>();
        remaining.add(new RoutePoint(currentX, currentY, "start"));

        int startIndex = Math.min(nearestSegmentIndex + 1, route.size() - 1);
        for (int i = startIndex; i < route.size(); i++) {
            NavigationRecalculateRequest.RoutePointInput p = route.get(i);
            String type = (i == route.size() - 1) ? "destination" : "waypoint";
            remaining.add(new RoutePoint(p.getX(), p.getY(), type));
        }

        return remaining;
    }

    private double distancePointToSegment(
            double px, double py,
            double x1, double y1,
            double x2, double y2
    ) {
        double dx = x2 - x1;
        double dy = y2 - y1;
        if (dx == 0 && dy == 0) {
            return calculateDistance(px, py, x1, y1);
        }
        double t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
        t = Math.max(0, Math.min(1, t));
        double projX = x1 + t * dx;
        double projY = y1 + t * dy;
        return calculateDistance(px, py, projX, projY);
    }

    private static class AStarNode {
        String nodeId;
        double fScore;

        AStarNode(String nodeId, double fScore) {
            this.nodeId = nodeId;
            this.fScore = fScore;
        }
    }
}
