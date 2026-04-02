package com.bookingplatform.imports;

import jakarta.enterprise.context.ApplicationScoped;

import java.util.Map;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.TimeUnit;

/**
 * Sliding-window rate limiter scoped to businessId (not IP).
 * Max 20 requests (preview + confirm combined) per businessId per rolling hour.
 * businessId scope prevents a single tenant from starving the Atlas M0 cluster.
 */
@ApplicationScoped
public class ImportRateLimiter {

    private static final int MAX_REQUESTS = 20;
    private static final long WINDOW_MILLIS = TimeUnit.HOURS.toMillis(1);

    private final Map<String, Queue<Long>> requestLog = new ConcurrentHashMap<>();

    /**
     * Checks whether the given businessId is within the rate limit.
     * If allowed, records the request timestamp and returns true.
     *
     * @param businessId the tenant identifier from JWT
     * @return true if the request is allowed, false if rate limit exceeded
     */
    public boolean isAllowed(String businessId) {
        long now = System.currentTimeMillis();
        long cutoff = now - WINDOW_MILLIS;

        Queue<Long> q = requestLog.computeIfAbsent(businessId, k -> new ConcurrentLinkedQueue<>());
        q.removeIf(t -> t < cutoff);

        if (q.size() >= MAX_REQUESTS) {
            return false;
        }

        q.add(now);
        return true;
    }
}
