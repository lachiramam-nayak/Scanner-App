package com.wayfinding.indoor.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "navigation_nodes")
public class NavigationNode {
    @Id
    private String id;
    
    private String floorId;
    private double x;
    private double y;
    
    // Connected node IDs for path finding
    private List<String> connectedNodes;
    
    // Optional: link to POI if this node is a destination
    private String poiId;
    
    // Node type: waypoint, junction, destination
    private String nodeType;
}
