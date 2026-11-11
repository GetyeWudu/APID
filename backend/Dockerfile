# syntax=docker/dockerfile:1

# ---- Stage 1: Build Spring Boot JAR (JDK 17) ----
FROM maven:3.9-eclipse-temurin-17-alpine AS builder
WORKDIR /build

# Copy pom.xml first to cache Maven dependencies across builds
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build application JAR
COPY src ./src
RUN mvn clean package -DskipTests -B

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

