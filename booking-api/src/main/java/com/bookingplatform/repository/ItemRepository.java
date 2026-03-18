package com.bookingplatform.repository;

import com.bookingplatform.model.Item;
import com.bookingplatform.model.ItemStatus;
import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class ItemRepository implements PanacheMongoRepository<Item> {

    public List<Item> findByBusinessId(String businessId) {
        return list("businessId", businessId);
    }

    public List<Item> findByBusinessAndStatus(String businessId, ItemStatus status) {
        return list("businessId = ?1 and status = ?2", businessId, status);
    }
}
