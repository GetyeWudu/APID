package com.boa.apid.common.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

import java.time.Duration;
import java.util.Map;

/**
 * Redis cache configuration with 5-minute safety TTL on user_permissions
 * and fail-safe PostgreSQL fallback if Redis is temporarily unavailable.
 */
@Configuration
public class RedisCacheConfig implements CachingConfigurer {

    private static final Logger log = LoggerFactory.getLogger(RedisCacheConfig.class);

    @Bean
    public RedisCacheConfiguration cacheConfiguration() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        mapper.activateDefaultTyping(
                LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY
        );

        return RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofHours(1))
                .disableCachingNullValues()
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(
                                new GenericJackson2JsonRedisSerializer(mapper)
                        )
                );
    }

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory factory, RedisCacheConfiguration baseConfig) {
        return RedisCacheManager.builder(factory)
                .cacheDefaults(baseConfig)
                .withInitialCacheConfigurations(Map.of(
                        "user_permissions", baseConfig.entryTtl(Duration.ofMinutes(5))
                ))
                .build();
    }

    @Override
    public CacheErrorHandler errorHandler() {
        // Safely fall back to PostgreSQL on Redis outage rather than serving stale or failing auth
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException ex, Cache cache, Object key) {
                log.warn("Redis cache GET failed on cache={} key={}; falling back to DB: {}",
                        cache.getName(), key, ex.getMessage());
            }

            @Override
            public void handleCachePutError(RuntimeException ex, Cache cache, Object key, Object value) {
                log.warn("Redis cache PUT failed on cache={} key={}: {}",
                        cache.getName(), key, ex.getMessage());
            }

            @Override
            public void handleCacheEvictError(RuntimeException ex, Cache cache, Object key) {
                log.warn("Redis cache EVICT failed on cache={} key={}: {}",
                        cache.getName(), key, ex.getMessage());
            }

            @Override
            public void handleCacheClearError(RuntimeException ex, Cache cache) {
                log.warn("Redis cache CLEAR failed on cache={}: {}",
                        cache.getName(), ex.getMessage());
            }
        };
    }
}
