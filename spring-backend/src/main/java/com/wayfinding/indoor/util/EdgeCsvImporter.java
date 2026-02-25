package com.wayfinding.indoor.util;

import java.util.ArrayList;
import java.util.List;

public class EdgeCsvImporter {

    public static List<EdgePair> parseCsv(String csvText) {
        List<EdgePair> pairs = new ArrayList<>();
        if (csvText == null || csvText.trim().isEmpty()) {
            return pairs;
        }
        String[] lines = csvText.split("\\r?\\n");
        for (String raw : lines) {
            String line = raw.trim();
            if (line.isEmpty()) continue;
            if (line.toLowerCase().startsWith("from") || line.toLowerCase().startsWith("node")) {
                continue; // skip header
            }
            String[] parts = line.split(",");
            if (parts.length < 2) continue;
            String from = parts[0].trim();
            String to = parts[1].trim();
            if (!from.isEmpty() && !to.isEmpty()) {
                pairs.add(new EdgePair(from, to));
            }
        }
        return pairs;
    }

    public record EdgePair(String fromNodeId, String toNodeId) {}
}
