package com.bookingplatform.resource;

import com.bookingplatform.model.Item;
import com.bookingplatform.model.ItemStatus;
import com.bookingplatform.model.Sale;
import com.bookingplatform.repository.ItemRepository;
import com.bookingplatform.repository.SaleRepository;
import com.bookingplatform.security.RoleChecker;
import com.bookingplatform.util.MoneyUtils;
import jakarta.inject.Inject;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import org.bson.types.Decimal128;
import org.bson.types.ObjectId;
import org.jboss.logging.Logger;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

@Path("/api/v1/items")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ItemResource {

    private static final Logger LOG = Logger.getLogger(ItemResource.class);

    @Inject
    ItemRepository itemRepository;

    @Inject
    SaleRepository saleRepository;

    @Inject
    Validator validator;

    @Context
    UriInfo uriInfo;

    @Context
    ContainerRequestContext requestContext;

    private String getOrgId() {
        String orgId = (String) requestContext.getProperty("orgId");
        if (orgId == null) {
            orgId = (String) requestContext.getProperty("businessId");
        }
        return orgId;
    }

    private String getRole() {
        return (String) requestContext.getProperty("role");
    }

    @POST
    public Response createItem(CreateItemRequest request) {
        if (!RoleChecker.can(getRole(), RoleChecker.CREATE_ITEM)) {
            return Response.status(403).entity("{\"message\":\"Forbidden\"}").type("application/json").build();
        }
        Set<ConstraintViolation<CreateItemRequest>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            List<String> errors = violations.stream()
                    .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                    .toList();
            return Response.status(400).entity(new ErrorResponse("Validation failed", errors)).build();
        }

        String orgId = getOrgId();
        // Use orgId from JWT, fall back to request body for backward compatibility
        String businessId = orgId != null ? orgId : request.businessId;

        Item item = new Item();
        item.businessId = businessId;
        item.name = request.name;
        item.brand = request.brand;
        item.category = request.category;
        item.condition = request.condition;
        item.purchasePrice = new Decimal128(request.purchasePrice);
        item.purchaseDate = request.purchaseDate;
        item.description = request.description;
        item.notes = request.notes;
        item.status = ItemStatus.AVAILABLE;
        item.costEntryPending = false;
        item.createdAt = Instant.now();
        item.updatedAt = Instant.now();

        itemRepository.persist(item);

        URI location = uriInfo.getAbsolutePathBuilder()
                .path(item.id.toHexString())
                .build();
        return Response.created(location).entity(ItemDTO.from(item)).build();
    }

    @GET
    public Response listItems(@QueryParam("businessId") String queryBusinessId,
                              @QueryParam("status") ItemStatus status) {
        String orgId = getOrgId();
        // Use orgId from JWT, fall back to query param for backward compatibility
        String businessId = orgId != null ? orgId : queryBusinessId;

        if (businessId == null || businessId.isBlank()) {
            return Response.status(400)
                    .entity(new ErrorResponse("businessId query parameter is required", List.of()))
                    .build();
        }

        List<Item> items;
        if (status != null) {
            items = itemRepository.findByBusinessAndStatus(businessId, status);
        } else {
            items = itemRepository.findByBusinessId(businessId);
        }

        List<ItemDTO> dtos = items.stream().map(ItemDTO::from).toList();
        return Response.ok(dtos).build();
    }

    @GET
    @Path("/{id}")
    public Response getItem(@PathParam("id") String id,
                            @QueryParam("businessId") String queryBusinessId) {
        String orgId = getOrgId();
        String businessId = orgId != null ? orgId : queryBusinessId;

        Item item;
        try {
            item = itemRepository.findById(new ObjectId(id));
        } catch (IllegalArgumentException e) {
            return Response.status(404).build();
        }

        if (item == null || !item.businessId.equals(businessId)) {
            return Response.status(404).build();
        }

        return Response.ok(ItemDTO.from(item)).build();
    }

    @PATCH
    @Path("/{id}")
    public Response updateItem(@PathParam("id") String id, UpdateItemRequest request) {
        Set<ConstraintViolation<UpdateItemRequest>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            List<String> errors = violations.stream()
                    .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                    .toList();
            return Response.status(400).entity(new ErrorResponse("Validation failed", errors)).build();
        }

        String businessId = getOrgId();

        Item item;
        try {
            item = itemRepository.findById(new ObjectId(id));
        } catch (IllegalArgumentException e) {
            return Response.status(404).build();
        }

        if (item == null || !item.businessId.equals(businessId)) {
            return Response.status(404).build();
        }

        // ── Cost entry block ──────────────────────────────────────
        boolean priceInBody = request.purchasePrice != null;
        boolean dateInBody = request.purchaseDate != null;

        if (priceInBody || dateInBody) {
            if (!item.costEntryPending) {
                return Response.status(400)
                        .entity(new ErrorResponse("purchasePrice and purchaseDate are immutable after creation", List.of()))
                        .build();
            }
            if (!priceInBody || !dateInBody) {
                return Response.status(400)
                        .entity(new ErrorResponse("purchasePrice and purchaseDate must be set together", List.of()))
                        .build();
            }
            if (request.purchasePrice.compareTo(BigDecimal.ZERO) < 0) {
                return Response.status(400)
                        .entity(new ErrorResponse("purchasePrice cannot be negative", List.of()))
                        .build();
            }
            if (request.purchaseDate.isAfter(Instant.now())) {
                return Response.status(400)
                        .entity(new ErrorResponse("purchaseDate cannot be in the future", List.of()))
                        .build();
            }

            item.purchasePrice = MoneyUtils.toDecimal128(request.purchasePrice);
            item.purchaseDate = request.purchaseDate;

            List<Sale> linked = saleRepository.findByItemIdAndBusinessId(
                    item.id.toHexString(), businessId);

            if (linked.isEmpty()) {
                LOG.warnf("Cost update: no linked sale for item %s in business %s", item.id, businessId);
                item.costEntryPending = false;
                item.updatedAt = Instant.now();
                itemRepository.update(item);
                return Response.ok(ItemDTO.from(item)).build();
            }

            Response.ResponseBuilder rb = Response.ok();
            if (linked.size() > 1) {
                LOG.warnf("Cost update: %d sales for item %s — expected 1, updating latest only", linked.size(), item.id);
                linked.sort(Comparator.comparing((Sale s) -> s.soldAt).reversed());
                rb = Response.ok().header("X-Warning", "multiple-sales-found");
            }

            Sale sale = linked.get(0);
            BigDecimal net = MoneyUtils.toBigDecimal(sale.netProceeds);
            sale.profit = MoneyUtils.toDecimal128(net.subtract(request.purchasePrice));
            try {
                saleRepository.update(sale);
            } catch (Exception e) {
                LOG.errorf(e, "Cost update: failed to recompute sale profit for item %s", item.id);
                return Response.status(500)
                        .entity(new ErrorResponse("Failed to recompute sale profit — no changes saved, please retry", List.of()))
                        .build();
            }

            item.costEntryPending = false;
            item.updatedAt = Instant.now();
            itemRepository.update(item);
            return rb.entity(ItemDTO.from(item)).build();
        }

        // ── Mutable-field update (no cost fields) ─────────────────
        if (request.name != null) item.name = request.name;
        if (request.brand != null) item.brand = request.brand;
        if (request.category != null) item.category = request.category;
        if (request.condition != null) item.condition = request.condition;
        if (request.description != null) item.description = request.description;
        if (request.notes != null) item.notes = request.notes;
        item.updatedAt = Instant.now();

        itemRepository.update(item);

        return Response.ok(ItemDTO.from(item)).build();
    }

    @DELETE
    @Path("/{id}")
    public Response deleteItem(@PathParam("id") String id,
                               @QueryParam("businessId") String queryBusinessId) {
        if (!RoleChecker.can(getRole(), RoleChecker.DELETE_ITEM)) {
            return Response.status(403).entity("{\"message\":\"Forbidden\"}").type("application/json").build();
        }
        String orgId = getOrgId();
        String businessId = orgId != null ? orgId : queryBusinessId;

        Item item;
        try {
            item = itemRepository.findById(new ObjectId(id));
        } catch (IllegalArgumentException e) {
            return Response.status(404).build();
        }

        if (item == null || !item.businessId.equals(businessId)) {
            return Response.status(404).build();
        }

        if (item.status == ItemStatus.SOLD) {
            return Response.status(409)
                    .entity(new ErrorResponse("Sold items cannot be deleted", List.of()))
                    .build();
        }

        itemRepository.delete(item);

        return Response.noContent().build();
    }

    public record ErrorResponse(String message, List<String> errors) {}
}
