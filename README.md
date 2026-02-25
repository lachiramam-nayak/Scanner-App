# Here are your Instructions
PROJECT CONTEXT:

We are building an Indoor Wayfinding System (Phase-1).

Tech stack:
- Backend: Java Spring Boot + MongoDB
- Frontend: Expo + React Native (already built, DO NOT change UI)
- Positioning: iBeacons ONLY (UUID + major + minor)
- Maps: Single-floor indoor map (PNG/JPEG)
- Coordinate system: (0,0) is top-left, pixel-based

GOAL:
Enable end-to-end flow:
Building → Floor → Map → iBeacon scan → current location → destination → navigation route (single floor).

DO NOT:
- Use QR codes
- Use GPS
- Use Python
- Regenerate frontend UI
- Implement trilateration or filters

Backend is the source of truth for:
- Buildings
- Floors
- Map dimensions
- Beacon coordinates
- Navigation graph
 mvn spring-boot:run
npm start -- --clear