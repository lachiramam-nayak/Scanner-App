package com.wayfinding.indoor.repository;

import com.wayfinding.indoor.model.Building;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BuildingRepository extends MongoRepository<Building, String> {
    Optional<Building> findByBuildingId(String buildingId);
}
