package com.wayfinding.indoor.controller;

import com.wayfinding.indoor.dto.CreatePOIRequest;
import com.wayfinding.indoor.model.POI;
import com.wayfinding.indoor.repository.POIRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pois")
@RequiredArgsConstructor
public class POIController {

    private final POIRepository poiRepository;

    @GetMapping
    public List<POI> getAllPOIs(@RequestParam(required = false) String building_id,
                                 @RequestParam(required = false) String floor_id,
                                 @RequestParam(required = false) String category) {
        if (floor_id != null && !floor_id.isEmpty()) {
            if (category != null && !category.isEmpty()) {
                return poiRepository.findByFloorIdAndCategory(floor_id, category);
            }
            return poiRepository.findByFloorId(floor_id);
        }
        if (building_id != null && !building_id.isEmpty()) {
            return poiRepository.findByBuildingId(building_id);
        }
        return poiRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<POI> getPOI(@PathVariable String id) {
        return poiRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<POI> createPOI(@RequestBody CreatePOIRequest request) {
        POI poi = new POI(
                request.getBuildingId(),
                request.getFloorId(),
                request.getName(),
                request.getCategory(),
                request.getX(),
                request.getY()
        );
        poi.setDescription(request.getDescription());
        POI saved = poiRepository.save(poi);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<POI> updatePOI(@PathVariable String id,
                                          @RequestBody CreatePOIRequest request) {
        return poiRepository.findById(id)
                .map(poi -> {
                    if (request.getName() != null) poi.setName(request.getName());
                    if (request.getCategory() != null) poi.setCategory(request.getCategory());
                    if (request.getX() > 0) poi.setX(request.getX());
                    if (request.getY() > 0) poi.setY(request.getY());
                    if (request.getDescription() != null) poi.setDescription(request.getDescription());
                    return ResponseEntity.ok(poiRepository.save(poi));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePOI(@PathVariable String id) {
        if (poiRepository.existsById(id)) {
            poiRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteByBuildingAndFloor(
            @RequestParam String buildingId,
            @RequestParam String floorId
    ) {
        long deleted = poiRepository.deleteByBuildingIdAndFloorId(buildingId, floorId);
        if (deleted == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }
}
