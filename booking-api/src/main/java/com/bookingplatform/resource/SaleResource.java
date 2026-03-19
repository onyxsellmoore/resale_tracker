package com.bookingplatform.resource;

import com.bookingplatform.model.Item;
import com.bookingplatform.model.ItemStatus;
import com.bookingplatform.model.Sale;
import com.bookingplatform.repository.ItemRepository;
import com.bookingplatform.repository.SaleRepository;
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

import java.math.BigDecimal;
import java.net.URI;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

@Path("/api/v1/sales")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SaleResource {

    @Inject
    SaleRepository saleRepository;

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

    private boolean hasRole(String... allowed) {
        String role = (String) requestContext.getProperty("role");
        if (role == null) return true;
        for (String r : allowed) {
            if (r.equals(role)) return true;
        }
        return false;
    }

    @POST
    public Response createSale(CreateSaleRequest request) {
        if (!hasRole("ADMIN", "SELLER")) {
            return Response.status(403).entity("{\"message\":\"Forbidden\"}").type("application/json").build();
        }
        Set<ConstraintViolation<CreateSaleRequest>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            List<String> errors = violations.stream()
                    .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                    .toList();
            return Response.status(400)
                    .entity(new ErrorResponse("Validation failed", errors))
                    .build();
        }

        // Validate platformFees <= salePrice
        if (request.platformFees.compareTo(request.salePrice) > 0) {
            return Response.status(400)
                    .entity(new ErrorResponse("platformFees cannot exceed salePrice", List.of()))
                    .build();
        }

        String orgId = getOrgId();
        String businessId = orgId != null ? orgId : request.businessId;

        // Duplicate detection: if platformOrderId is provided, check for existing sale
        if (request.platformOrderId != null && !request.platformOrderId.isBlank()) {
            long existing = saleRepository.count(
                    "businessId = ?1 and platform = ?2 and platformOrderId = ?3",
                    businessId, request.platform, request.platformOrderId);
            if (existing > 0) {
                return Response.status(409)
                        .entity(new ErrorResponse("Sale already imported", List.of()))
                        .build();
            }
        }

        // Look up item
        Item item;
        try {
            item = itemRepository.findById(new ObjectId(request.itemId));
        } catch (IllegalArgumentException e) {
            return Response.status(404)
                    .entity(new ErrorResponse("Item not found", List.of()))
                    .build();
        }

        if (item == null || !item.businessId.equals(businessId)) {
            return Response.status(404)
                    .entity(new ErrorResponse("Item not found", List.of()))
                    .build();
        }

        if (item.status == ItemStatus.SOLD) {
            return Response.status(409)
                    .entity(new ErrorResponse("Item is already sold", List.of()))
                    .build();
        }

        // Compute fields
        BigDecimal netProceeds = request.salePrice.subtract(request.platformFees);
        BigDecimal purchasePrice = item.purchasePrice.bigDecimalValue();
        BigDecimal profit = netProceeds.subtract(purchasePrice);

        // Build sale
        Sale sale = new Sale();
        sale.businessId = businessId;
        sale.itemId = request.itemId;
        sale.platform = request.platform;
        sale.salePrice = new Decimal128(request.salePrice);
        sale.platformFees = new Decimal128(request.platformFees);
        sale.netProceeds = new Decimal128(netProceeds);
        sale.profit = new Decimal128(profit);
        sale.soldAt = request.soldAt;
        sale.platformOrderId = request.platformOrderId;
        sale.notes = request.notes;
        sale.createdAt = Instant.now();

        // Atomic: save sale first, then mark item SOLD
        saleRepository.persist(sale);
        item.status = ItemStatus.SOLD;
        item.updatedAt = Instant.now();
        itemRepository.update(item);

        URI location = uriInfo.getAbsolutePathBuilder()
                .path(sale.id.toHexString())
                .build();
        return Response.created(location)
                .entity(SaleDTO.from(sale, item.name, item.brand))
                .build();
    }

    @GET
    public Response listSales(@QueryParam("businessId") String queryBusinessId,
                              @QueryParam("platform") String platform,
                              @QueryParam("from") Instant from,
                              @QueryParam("to") Instant to) {
        String orgId = getOrgId();
        String businessId = orgId != null ? orgId : queryBusinessId;

        if (businessId == null || businessId.isBlank()) {
            return Response.status(400)
                    .entity(new ErrorResponse("businessId query parameter is required", List.of()))
                    .build();
        }

        List<Sale> sales;
        if (from != null && to != null) {
            sales = saleRepository.findByBusinessAndSoldAtRange(businessId, from, to);
        } else {
            sales = saleRepository.findByBusinessId(businessId);
        }

        // Filter by platform if specified
        if (platform != null && !platform.isBlank()) {
            sales = sales.stream()
                    .filter(s -> platform.equals(s.platform))
                    .toList();
        }

        // Sort newest first
        List<SaleDTO> dtos = sales.stream()
                .sorted(Comparator.comparing((Sale s) -> s.soldAt).reversed())
                .map(s -> {
                    Item item = lookupItem(s.itemId);
                    String itemName = item != null ? item.name : null;
                    String itemBrand = item != null ? item.brand : null;
                    return SaleDTO.from(s, itemName, itemBrand);
                })
                .toList();

        return Response.ok(dtos).build();
    }

    @GET
    @Path("/{id}")
    public Response getSale(@PathParam("id") String id,
                            @QueryParam("businessId") String queryBusinessId) {
        String orgId = getOrgId();
        String businessId = orgId != null ? orgId : queryBusinessId;

        Sale sale;
        try {
            sale = saleRepository.findById(new ObjectId(id));
        } catch (IllegalArgumentException e) {
            return Response.status(404).build();
        }

        if (sale == null || !sale.businessId.equals(businessId)) {
            return Response.status(404).build();
        }

        Item item = lookupItem(sale.itemId);
        String itemName = item != null ? item.name : null;
        String itemBrand = item != null ? item.brand : null;
        return Response.ok(SaleDTO.from(sale, itemName, itemBrand)).build();
    }

    @DELETE
    @Path("/{id}")
    public Response deleteSale(@PathParam("id") String id) {
        if (!hasRole("ADMIN", "SELLER")) {
            return Response.status(403).entity("{\"message\":\"Forbidden\"}").type("application/json").build();
        }

        String orgId = getOrgId();

        com.bookingplatform.model.Sale sale;
        try {
            sale = saleRepository.findById(new ObjectId(id));
        } catch (IllegalArgumentException e) {
            return Response.status(404).build();
        }

        if (sale == null || !sale.businessId.equals(orgId)) {
            return Response.status(404).build();
        }

        // Restore item to AVAILABLE
        Item item = lookupItem(sale.itemId);
        if (item != null && item.status == ItemStatus.SOLD) {
            item.status = ItemStatus.AVAILABLE;
            item.updatedAt = Instant.now();
            itemRepository.update(item);
        }

        saleRepository.delete(sale);
        return Response.noContent().build();
    }

    private Item lookupItem(String itemId) {
        try {
            return itemRepository.findById(new ObjectId(itemId));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public record ErrorResponse(String message, List<String> errors) {}
}
