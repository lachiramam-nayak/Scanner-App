package com.wayfinding.indoor.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "nodes")
public class GraphNode {
    @Id
    private String id;

    private String nodeId;
    private String buildingId;
    private String floorId;
    private double x;
    private double y;
}
