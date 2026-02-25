package com.wayfinding.indoor.repository;

import com.wayfinding.indoor.model.Floor;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FloorRepository extends MongoRepository<Floor, String> {
    List<Floor> findByBuildingIdOrderByFloorNumberAsc(String buildingId);
    Optional<Floor> findByFloorId(String floorId);
}
