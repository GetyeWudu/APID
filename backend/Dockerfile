# syntax=docker/dockerfile:1

# ---- Stage 1: Build Spring Boot JAR (JDK 17) ----
FROM maven:3.9-eclipse-temurin-17-alpine AS builder
WORKDIR /build

COPY pom.xml .
COPY src ./src

# Cache Maven repository across builds (including pom.xml updates) and skip bloated go-offline
RUN --mount=type=cache,target=/root/.m2 \
    mvn clean package -DskipTests -B

# ---- Stage 2: Minimal Runtime Image ----
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Create non-root user and uploads directory
RUN addgroup -S apid && adduser -S apid -G apid \
    && mkdir -p /app/uploads \
    && chown -R apid:apid /app

COPY --from=builder /build/target/*.jar /app/app.jar
RUN chown apid:apid /app/app.jar

USER apid

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
