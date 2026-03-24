package com.bookingplatform.resource;

import com.bookingplatform.security.RoleChecker;
import com.bookingplatform.service.AnalyticsResult;
import com.bookingplatform.service.AnalyticsService;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.time.LocalDate;

@Path("/api/v1/analytics")
@Produces(MediaType.APPLICATION_JSON)
public class AnalyticsResource {

    @Inject
    AnalyticsService analyticsService;

    @Context
    ContainerRequestContext requestContext;

    @GET
    public Response getAnalytics(
            @QueryParam("businessId") String queryBusinessId,
            @QueryParam("from") String from,
            @QueryParam("to") String to) {

        String role = (String) requestContext.getProperty("role");
        if (!RoleChecker.can(role, RoleChecker.VIEW_ANALYTICS)) {
            return Response.status(403).entity("{\"message\":\"Forbidden\"}").type("application/json").build();
        }

        String orgId = (String) requestContext.getProperty("orgId");
        if (orgId == null) {
            orgId = (String) requestContext.getProperty("businessId");
        }
        String businessId = orgId != null ? orgId : queryBusinessId;

        if (businessId == null || businessId.isBlank()) {
            return Response.status(400).entity("businessId is required").build();
        }
        if (from == null || to == null) {
            return Response.status(400).entity("from and to date parameters are required").build();
        }

        LocalDate fromDate = LocalDate.parse(from);
        LocalDate toDate = LocalDate.parse(to);

        AnalyticsResult result = analyticsService.getAnalytics(businessId, fromDate, toDate);
        return Response.ok(result).build();
    }
}
