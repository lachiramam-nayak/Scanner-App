package com.wayfinding.indoor.repository;

import com.wayfinding.indoor.model.GraphEdge;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GraphEdgeRepository extends MongoRepository<GraphEdge, String> {
    List<GraphEdge> findByBuildingIdAndFloorId(String buildingId, String floorId);
}
