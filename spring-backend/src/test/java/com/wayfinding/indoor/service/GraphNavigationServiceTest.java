package com.wayfinding.indoor.service;

import com.wayfinding.indoor.model.GraphEdge;
import com.wayfinding.indoor.model.GraphNode;
import com.wayfinding.indoor.repository.GraphEdgeRepository;
import com.wayfinding.indoor.repository.GraphNodeRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GraphNavigationServiceTest {

    @Test
    void computeShortestPath_picksShortestRoute() {
        GraphNodeRepository nodeRepo = Mockito.mock(GraphNodeRepository.class);
        GraphEdgeRepository edgeRepo = Mockito.mock(GraphEdgeRepository.class);
        GraphNavigationService service = new GraphNavigationService(nodeRepo, edgeRepo);

        List<GraphNode> nodes = Arrays.asList(
                new GraphNode("1", "A", "B1", "F1", 0, 0),
                new GraphNode("2", "B", "B1", "F1", 1, 0),
                new GraphNode("3", "C", "B1", "F1", 2, 0),
                new GraphNode("4", "D", "B1", "F1", 0, 2)
        );

        List<GraphEdge> edges = Arrays.asList(
                new GraphEdge("e1", "A", "B", "B1", "F1", 1.0),
                new GraphEdge("e2", "B", "C", "B1", "F1", 1.0),
                new GraphEdge("e3", "A", "D", "B1", "F1", 5.0),
                new GraphEdge("e4", "D", "C", "B1", "F1", 5.0)
        );

        List<String> path = service.computeShortestPath(nodes, edges, "A", "C");
        assertEquals(Arrays.asList("A", "B", "C"), path);
    }

    @Test
    void computeShortestPath_noPath_returnsEmpty() {
        GraphNodeRepository nodeRepo = Mockito.mock(GraphNodeRepository.class);
        GraphEdgeRepository edgeRepo = Mockito.mock(GraphEdgeRepository.class);
        GraphNavigationService service = new GraphNavigationService(nodeRepo, edgeRepo);

        List<GraphNode> nodes = Arrays.asList(
                new GraphNode("1", "A", "B1", "F1", 0, 0),
                new GraphNode("2", "B", "B1", "F1", 1, 0)
        );

        List<GraphEdge> edges = Collections.emptyList();

        List<String> path = service.computeShortestPath(nodes, edges, "A", "B");
        assertEquals(Collections.emptyList(), path);
    }

    @Test
    void computePath_returnsExpectedPathForGivenCoordinates() {
        GraphNodeRepository nodeRepo = Mockito.mock(GraphNodeRepository.class);
        GraphEdgeRepository edgeRepo = Mockito.mock(GraphEdgeRepository.class);
        GraphNavigationService service = new GraphNavigationService(nodeRepo, edgeRepo);

        String buildingId = "698b7b18399ebc682c0e97ac";
        String floorId = "F1";

        List<GraphNode> nodes = Arrays.asList(
                new GraphNode("1", "n1", buildingId, floorId, 105, 85),
                new GraphNode("2", "n2", buildingId, floorId, 105, 405),
                new GraphNode("3", "n3", buildingId, floorId, 215, 405),
                new GraphNode("4", "n4", buildingId, floorId, 375, 405),
                new GraphNode("5", "n5", buildingId, floorId, 375, 200),
                new GraphNode("6", "n6", buildingId, floorId, 215, 625)
        );

        List<GraphEdge> edges = Arrays.asList(
                new GraphEdge("e1", "n1", "n2", buildingId, floorId, 320),
                new GraphEdge("e2", "n2", "n3", buildingId, floorId, 110),
                new GraphEdge("e3", "n3", "n4", buildingId, floorId, 160),
                new GraphEdge("e4", "n4", "n5", buildingId, floorId, 205),
                new GraphEdge("e5", "n3", "n6", buildingId, floorId, 220)
        );

        Mockito.when(nodeRepo.findByBuildingIdAndFloorId(buildingId, floorId)).thenReturn(nodes);
        Mockito.when(edgeRepo.findByBuildingIdAndFloorId(buildingId, floorId)).thenReturn(edges);

        var resp = service.computePath(buildingId, floorId, 330, 150, 120, 470);
        assertTrue(resp.getPath().size() >= 4);
        // Expected nearest-node path: n5 -> n4 -> n3 -> n2
        assertEquals(375, resp.getPath().get(1).getX(), 0.01);
        assertEquals(200, resp.getPath().get(1).getY(), 0.01);
        assertEquals(375, resp.getPath().get(2).getX(), 0.01);
        assertEquals(405, resp.getPath().get(2).getY(), 0.01);
        assertEquals(215, resp.getPath().get(3).getX(), 0.01);
        assertEquals(405, resp.getPath().get(3).getY(), 0.01);
        assertEquals(105, resp.getPath().get(4).getX(), 0.01);
        assertEquals(405, resp.getPath().get(4).getY(), 0.01);
    }
}
