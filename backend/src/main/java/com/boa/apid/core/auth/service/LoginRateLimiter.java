package com.boa.apid.core.auth.service;

import com.boa.apid.common.exception.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory sliding-window rate limiter protecting /login and /refresh endpoints against brute-force floods.
 */
@Service
public class LoginRateLimiter {

    private static final Duration WINDOW = Duration.ofMinutes(1);
    private static final int MAX_PER_IP = 30;
    private static final int MAX_PER_IP_AND_USER = 10;

    private final ConcurrentHashMap<String, Deque<Instant>> buckets = new ConcurrentHashMap<>();

    public void checkLoginAllowed(String clientIp, String username) {
        String ipKey = "ip:" + safe(clientIp);
        if (!tryAcquire(ipKey, MAX_PER_IP)) {
            throw new BusinessException("RATE_LIMIT_EXCEEDED",
                    "Too many login requests. Please try again shortly.", HttpStatus.TOO_MANY_REQUESTS);
        }
        if (username != null && !username.isBlank()) {
            String userKey = "ip_user:" + safe(clientIp) + ":" + username.trim().toLowerCase(Locale.ROOT);
            if (!tryAcquire(userKey, MAX_PER_IP_AND_USER)) {
                throw new BusinessException("RATE_LIMIT_EXCEEDED",
                        "Too many login requests. Please try again shortly.", HttpStatus.TOO_MANY_REQUESTS);
            }
        }
    }

    public void checkRefreshAllowed(String clientIp) {
        String key = "refresh_ip:" + safe(clientIp);
        if (!tryAcquire(key, MAX_PER_IP)) {
            throw new BusinessException("RATE_LIMIT_EXCEEDED",
                    "Too many session refresh requests. Please try again shortly.", HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    private boolean tryAcquire(String key, int maxRequests) {
        Instant now = Instant.now();
        Instant cutoff = now.minus(WINDOW);
        Deque<Instant> timestamps = buckets.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (timestamps) {
            while (!timestamps.isEmpty() && timestamps.peekFirst().isBefore(cutoff)) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= maxRequests) {
                return false;
            }
            timestamps.addLast(now);
            return true;
        }
    }

    private String safe(String ip) {
        return (ip == null || ip.isBlank()) ? "unknown" : ip.trim();
    }
}

