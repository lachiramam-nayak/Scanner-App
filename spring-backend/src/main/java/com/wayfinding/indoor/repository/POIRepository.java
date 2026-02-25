package com.wayfinding.indoor.repository;

import com.wayfinding.indoor.model.POI;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface POIRepository extends MongoRepository<POI, String> {
    List<POI> findByFloorId(String floorId);
    List<POI> findByBuildingId(String buildingId);
    List<POI> findByFloorIdAndCategory(String floorId, String category);
    long deleteByBuildingIdAndFloorId(String buildingId, String floorId);
}
