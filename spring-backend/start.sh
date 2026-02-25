#!/bin/bash
# Start Spring Boot Indoor Wayfinding Backend

cd /app/spring-backend

# Set environment variables from the existing backend .env
export MONGO_URL="mongodb://localhost:27017"
export DB_NAME="indoor_wayfinding"

# Build and run
mvn clean package -DskipTests
java -jar target/indoor-wayfinding-1.0.0.jar
