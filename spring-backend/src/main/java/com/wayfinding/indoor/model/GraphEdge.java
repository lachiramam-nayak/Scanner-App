package com.wayfinding.indoor.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "edges")
public class GraphEdge {
    @Id
    private String id;

    private String fromNodeId;
    private String toNodeId;
    private String buildingId;
    private String floorId;
    private double weight;
}
