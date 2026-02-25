package com.wayfinding.indoor.repository;

import com.wayfinding.indoor.model.Beacon;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BeaconRepository extends MongoRepository<Beacon, String> {
    List<Beacon> findByFloorId(String floorId);
    List<Beacon> findByBuildingId(String buildingId);
    List<Beacon> findByBuildingIdAndFloorId(String buildingId, String floorId);
    Optional<Beacon> findByUuidAndMajorAndMinor(String uuid, Integer major, Integer minor);
}
