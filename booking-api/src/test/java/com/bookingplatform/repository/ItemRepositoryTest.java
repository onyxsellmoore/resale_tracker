package com.bookingplatform.repository;

import com.bookingplatform.model.Item;
import com.bookingplatform.model.ItemCondition;
import com.bookingplatform.model.ItemStatus;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.mongodb.MongoTestResource;
import jakarta.inject.Inject;
import org.bson.types.Decimal128;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
@QuarkusTestResource(MongoTestResource.class)
class ItemRepositoryTest {

    @Inject
    ItemRepository itemRepository;

    @BeforeEach
    void setUp() {
        itemRepository.deleteAll();
    }

    @Test
    void saveAndFindById_roundTrips() {
        Item item = buildItem("biz1", "Gucci Bag", ItemStatus.AVAILABLE);
        itemRepository.persist(item);
        assertNotNull(item.id);

        Item found = itemRepository.findById(item.id);
        assertNotNull(found);
        assertEquals("Gucci Bag", found.name);
        assertEquals("Gucci", found.brand);
        assertEquals(ItemCondition.EXCELLENT, found.condition);
        assertEquals(ItemStatus.AVAILABLE, found.status);
        assertEquals(new BigDecimal("250.00"), found.purchasePrice.bigDecimalValue());
    }

    @Test
    void findByBusinessId_onlyReturnsMatchingBusiness() {
        itemRepository.persist(buildItem("biz1", "Item A", ItemStatus.AVAILABLE));
        itemRepository.persist(buildItem("biz2", "Item B", ItemStatus.AVAILABLE));
        itemRepository.persist(buildItem("biz1", "Item C", ItemStatus.AVAILABLE));

        List<Item> biz1Items = itemRepository.findByBusinessId("biz1");
        assertEquals(2, biz1Items.size());
        assertTrue(biz1Items.stream().allMatch(i -> "biz1".equals(i.businessId)));
    }

    @Test
    void findByStatus_availableExcludesSold() {
        itemRepository.persist(buildItem("biz1", "Available Item", ItemStatus.AVAILABLE));
        itemRepository.persist(buildItem("biz1", "Sold Item", ItemStatus.SOLD));

        List<Item> available = itemRepository.findByBusinessAndStatus("biz1", ItemStatus.AVAILABLE);
        assertEquals(1, available.size());
        assertEquals("Available Item", available.get(0).name);
    }

    @Test
    void businessIdIsolation_wrongBusinessReturnsEmpty() {
        itemRepository.persist(buildItem("biz1", "Item A", ItemStatus.AVAILABLE));

        List<Item> result = itemRepository.findByBusinessId("biz_other");
        assertTrue(result.isEmpty());
    }

    private Item buildItem(String businessId, String name, ItemStatus status) {
        Item item = new Item();
        item.businessId = businessId;
        item.name = name;
        item.brand = "Gucci";
        item.category = "Handbags";
        item.condition = ItemCondition.EXCELLENT;
        item.purchasePrice = new Decimal128(new BigDecimal("250.00"));
        item.purchaseDate = Instant.parse("2025-01-15T00:00:00Z");
        item.status = status;
        item.createdAt = Instant.now();
        item.updatedAt = Instant.now();
        return item;
    }
}
