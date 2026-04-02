package com.bookingplatform.resource;

import com.bookingplatform.imports.ImportRateLimiter;
import com.bookingplatform.imports.ImportService;
import com.bookingplatform.imports.dto.ImportConfirmRequest;
import com.bookingplatform.imports.dto.ImportPreviewResponse;
import com.bookingplatform.imports.dto.ImportResultResponse;
import com.bookingplatform.imports.model.Platform;
import com.bookingplatform.security.RoleChecker;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.multipart.FileUpload;
import org.jboss.resteasy.reactive.RestForm;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;

/**
 * REST resource for CSV import operations (preview + confirm).
 * Both endpoints are ADMIN-only because import creates both Items and Sales.
 */
@Path("/api/v1/imports")
@Produces(MediaType.APPLICATION_JSON)
public class ImportResource {

    @Inject ImportService importService;
    @Inject ImportRateLimiter importRateLimiter;
    @Context ContainerRequestContext requestContext;

    /**
     * Returns the orgId from the JWT-authenticated request context.
     *
     * @return the business/org ID string
     */
    private String getOrgId() {
        String orgId = (String) requestContext.getProperty("orgId");
        return orgId != null ? orgId : (String) requestContext.getProperty("businessId");
    }

    /**
     * Returns the role from the JWT-authenticated request context.
     *
     * @return the role string (ADMIN, BUYER, SELLER, ACCOUNTANT)
     */
    private String getRole() {
        return (String) requestContext.getProperty("role");
    }

    /**
     * Previews a CSV import: parses the file, detects duplicates, returns row details.
     * Does not persist anything.
     *
     * @param file     the uploaded CSV file (multipart)
     * @param platform the platform enum name (EBAY, POSHMARK, MERCARI)
     * @return 200 with ImportPreviewResponse, or 400/403/429 on error
     */
    @POST
    @Path("/preview")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response preview(@RestForm("file") FileUpload file, @RestForm("platform") String platform) {
        // Role check
        if (!RoleChecker.can(getRole(), RoleChecker.IMPORT)) {
            return Response.status(403).entity("{\"message\":\"Forbidden\"}").build();
        }

        String businessId = getOrgId();

        // Content type / filename validation
        String fileName = file.fileName();
        String contentType = file.contentType();
        boolean isCsvFilename = fileName != null && fileName.toLowerCase().endsWith(".csv");
        boolean isCsvContentType = contentType != null &&
            (contentType.equals("text/csv") || contentType.equals("application/csv"));
        if (!isCsvFilename && !isCsvContentType) {
            return Response.status(400).entity("{\"message\":\"File must be a CSV\"}").build();
        }

        // File size check
        try {
            long fileSize = Files.size(file.uploadedFile());
            if (fileSize > 5L * 1024 * 1024) {
                return Response.status(400).entity("{\"message\":\"File exceeds 5 MB limit\"}").build();
            }
        } catch (IOException e) {
            return Response.status(400).entity("{\"message\":\"Cannot read file size\"}").build();
        }

        // Rate limit
        if (!importRateLimiter.isAllowed(businessId)) {
            return Response.status(429).entity("{\"message\":\"Rate limit exceeded\"}").build();
        }

        // Parse platform enum
        Platform platformEnum;
        try {
            platformEnum = Platform.valueOf(platform);
        } catch (IllegalArgumentException e) {
            return Response.status(400).entity("{\"message\":\"Unknown platform: " + platform + "\"}").build();
        }

        // Call service
        try (InputStream is = Files.newInputStream(file.uploadedFile())) {
            ImportPreviewResponse response = importService.preview(platformEnum, is, businessId);
            return Response.ok(response).build();
        } catch (IOException e) {
            return Response.status(500).entity("{\"message\":\"Failed to read uploaded file\"}").build();
        }
    }

    /**
     * Confirms an import: creates Items and Sales for valid, non-duplicate rows.
     * Server re-validates all rows and re-checks duplicates.
     *
     * @param body the confirm request with platform and rows
     * @return 200 with ImportResultResponse, or 400/403/429 on error
     */
    @POST
    @Path("/confirm")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response confirm(ImportConfirmRequest body) {
        // Role check
        if (!RoleChecker.can(getRole(), RoleChecker.IMPORT)) {
            return Response.status(403).entity("{\"message\":\"Forbidden\"}").build();
        }

        String businessId = getOrgId();

        // Rate limit
        if (!importRateLimiter.isAllowed(businessId)) {
            return Response.status(429).entity("{\"message\":\"Rate limit exceeded\"}").build();
        }

        // Row cap
        if (body.rows() != null && body.rows().size() > 2000) {
            return Response.status(400).entity("{\"message\":\"Row limit is 2000\"}").build();
        }

        // Parse platform enum
        if (body.platform() == null) {
            return Response.status(400).entity("{\"message\":\"Platform is required\"}").build();
        }
        Platform platformEnum;
        try {
            platformEnum = Platform.valueOf(body.platform());
        } catch (IllegalArgumentException e) {
            return Response.status(400).entity("{\"message\":\"Unknown platform: " + body.platform() + "\"}").build();
        }

        ImportResultResponse response = importService.confirm(
            platformEnum, body.rows() != null ? body.rows() : java.util.List.of(), businessId);
        return Response.ok(response).build();
    }
}
