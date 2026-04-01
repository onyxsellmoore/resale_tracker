package com.bookingplatform.repository;

import com.bookingplatform.model.Sale;
import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.time.Instant;
import java.util.List;

@ApplicationScoped
public class SaleRepository implements PanacheMongoRepository<Sale> {

    public List<Sale> findByBusinessId(String businessId) {
        return list("businessId", businessId);
    }

    public List<Sale> findByBusinessAndSoldAtRange(String businessId, Instant start, Instant end) {
        return list("businessId = ?1 and soldAt >= ?2 and soldAt < ?3", businessId, start, end);
    }

    /**
     * Returns all Sales linked to the given item within the same business.
     * Normally returns 0 or 1. More than 1 indicates a data anomaly; callers handle defensively.
     */
    public List<Sale> findByItemIdAndBusinessId(String itemId, String businessId) {
        return list("itemId = ?1 and businessId = ?2", itemId, businessId);
    }
}
