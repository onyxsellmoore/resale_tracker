package com.bookingplatform.resource;

import com.bookingplatform.model.Item;
import com.bookingplatform.model.ItemStatus;
import com.bookingplatform.repository.ItemRepository;
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

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Set;

@Path("/api/v1/items")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ItemResource {

    @Inject
    ItemRepository itemRepository;

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

    private boolean hasRole(String... allowed) {
        String role = getRole();
        if (role == null) return true; // No role enforcement when security is disabled
        for (String r : allowed) {
            if (r.equals(role)) return true;
        }
        return false;
    }

    private static final Response FORBIDDEN = Response.status(403)
            .entity("{\"message\":\"Forbidden\"}").type("application/json").build();

    @POST
    public Response createItem(CreateItemRequest request) {
        if (!hasRole("ADMIN", "BUYER")) {
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

        String orgId = getOrgId();
        String businessId = orgId != null ? orgId : request.businessId;

        Item item;
        try {
            item = itemRepository.findById(new ObjectId(id));
        } catch (IllegalArgumentException e) {
            return Response.status(404).build();
        }

        if (item == null || !item.businessId.equals(businessId)) {
            return Response.status(404).build();
        }

        // Only update allowed fields — purchasePrice and purchaseDate are immutable
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
        if (!hasRole("ADMIN")) {
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

        item.status = ItemStatus.DELETED;
        item.updatedAt = Instant.now();
        itemRepository.update(item);

        return Response.noContent().build();
    }

    public record ErrorResponse(String message, List<String> errors) {}
}
