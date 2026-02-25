package com.wayfinding.indoor.repository;

import com.wayfinding.indoor.model.NavigationNode;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NavigationNodeRepository extends MongoRepository<NavigationNode, String> {
    List<NavigationNode> findByFloorId(String floorId);
    long deleteByFloorId(String floorId);
}
