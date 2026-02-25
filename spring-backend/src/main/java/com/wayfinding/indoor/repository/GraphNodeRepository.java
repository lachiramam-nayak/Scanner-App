package com.wayfinding.indoor.repository;

import com.wayfinding.indoor.model.GraphNode;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GraphNodeRepository extends MongoRepository<GraphNode, String> {
    List<GraphNode> findByBuildingIdAndFloorId(String buildingId, String floorId);
    Optional<GraphNode> findByNodeIdAndBuildingIdAndFloorId(String nodeId, String buildingId, String floorId);
    long deleteByNodeId(String nodeId);
    long deleteByBuildingIdAndFloorId(String buildingId, String floorId);
}
