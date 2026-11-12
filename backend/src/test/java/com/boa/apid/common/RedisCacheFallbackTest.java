package com.boa.apid.common;

import com.boa.apid.common.config.RedisCacheConfig;
import com.boa.apid.core.organization.dto.DepartmentDto;
import com.boa.apid.core.organization.entity.Department;
import com.boa.apid.core.organization.repository.DepartmentRepository;
import com.boa.apid.core.organization.repository.EmployeeRepository;
import com.boa.apid.core.organization.service.DepartmentCacheStore;
import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.RedisConnectionFailureException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class RedisCacheFallbackTest {

    @Configuration
    @EnableCaching
    static class FailingRedisConfig implements CachingConfigurer {
        @Bean
        @Override
        public CacheManager cacheManager() {
            Cache failingCache = mock(Cache.class);
            when(failingCache.getName()).thenReturn("org_departments");
            when(failingCache.get(any())).thenThrow(new RedisConnectionFailureException("Redis down"));
            doThrow(new RedisConnectionFailureException("Redis down")).when(failingCache).put(any(), any());
            doThrow(new RedisConnectionFailureException("Redis down")).when(failingCache).evict(any());
            doThrow(new RedisConnectionFailureException("Redis down")).when(failingCache).clear();

            CacheManager manager = mock(CacheManager.class);
            when(manager.getCache("org_departments")).thenReturn(failingCache);
            return manager;
        }

        @Override
        public CacheErrorHandler errorHandler() {
            return new RedisCacheConfig().errorHandler();
        }

        @Bean
        DepartmentRepository departmentRepository() {
            DepartmentRepository repo = mock(DepartmentRepository.class);
            Department dept = new Department();
            dept.setId(10L);
            dept.setName("Engineering Fallback");
            dept.setActive(true);
            when(repo.findAllByActiveTrueOrderByNameAsc()).thenReturn(List.of(dept));
            return repo;
        }

        @Bean
        EmployeeRepository employeeRepository() {
            return mock(EmployeeRepository.class);
        }

        @Bean
        DepartmentCacheStore departmentCacheStore(DepartmentRepository deptRepo, EmployeeRepository empRepo) {
            return new DepartmentCacheStore(deptRepo, empRepo);
        }
    }

    @Test
    void whenRedisThrowsConnectionFailure_cacheFallsBackToDatabaseCleanly() {
        try (AnnotationConfigApplicationContext ctx = new AnnotationConfigApplicationContext(FailingRedisConfig.class)) {
            DepartmentCacheStore store = ctx.getBean(DepartmentCacheStore.class);
            DepartmentRepository repo = ctx.getBean(DepartmentRepository.class);

            List<DepartmentDto> result = store.getActiveDepartmentsCached();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getName()).isEqualTo("Engineering Fallback");
            verify(repo, times(1)).findAllByActiveTrueOrderByNameAsc();
        }
    }
}

