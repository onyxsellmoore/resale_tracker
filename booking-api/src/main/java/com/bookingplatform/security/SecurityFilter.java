package com.bookingplatform.security;

import com.bookingplatform.service.AuthService;
import com.nimbusds.jwt.JWTClaimsSet;
import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.ext.Provider;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.Optional;
import java.util.Set;

@Provider
@Priority(Priorities.AUTHENTICATION)
public class SecurityFilter implements ContainerRequestFilter {

    @Inject
    AuthService authService;

    @ConfigProperty(name = "booking.security.enabled", defaultValue = "true")
    boolean securityEnabled;

    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        if (!securityEnabled) {
            return;
        }

        String path = requestContext.getUriInfo().getPath();

        // Allow auth endpoints and health/dev-ui through
        if (path.startsWith("/api/v1/auth/") ||
            path.startsWith("/q/")) {
            return;
        }

        // Non-API paths don't need auth
        if (!path.startsWith("/api/")) {
            return;
        }

        // Extract Bearer token
        String authHeader = requestContext.getHeaderString("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            requestContext.abortWith(Response.status(401)
                    .entity("{\"message\":\"Authentication required\"}")
                    .type("application/json")
                    .build());
            return;
        }

        String token = authHeader.substring(7);
        Optional<JWTClaimsSet> claimsOpt = authService.verifyToken(token);
        if (claimsOpt.isEmpty()) {
            requestContext.abortWith(Response.status(401)
                    .entity("{\"message\":\"Invalid or expired token\"}")
                    .type("application/json")
                    .build());
            return;
        }

        JWTClaimsSet claims = claimsOpt.get();

        // Support both new orgId and legacy businessId claims
        String orgId;
        String role;
        try {
            orgId = claims.getStringClaim("orgId");
            if (orgId == null) {
                orgId = claims.getStringClaim("businessId");
            }
            role = claims.getStringClaim("role");
        } catch (Exception e) {
            requestContext.abortWith(Response.status(401)
                    .entity("{\"message\":\"Invalid token claims\"}")
                    .type("application/json")
                    .build());
            return;
        }

        // Extract businessId from request for backward compatibility
        String requestBusinessId = extractBusinessId(requestContext);

        if (requestBusinessId != null && !requestBusinessId.equals(orgId)) {
            requestContext.abortWith(Response.status(403)
                    .entity("{\"message\":\"Business ID mismatch\"}")
                    .type("application/json")
                    .build());
            return;
        }

        // Store claims in request context for downstream use
        requestContext.setProperty("ownerId", claims.getSubject());
        requestContext.setProperty("userId", claims.getSubject());
        requestContext.setProperty("businessId", orgId);
        requestContext.setProperty("orgId", orgId);
        if (role != null) {
            requestContext.setProperty("role", role);
        }

        // Set JAX-RS SecurityContext so @RolesAllowed works
        final String userRole = role;
        final String userId = claims.getSubject();
        requestContext.setSecurityContext(new SecurityContext() {
            @Override
            public Principal getUserPrincipal() {
                return () -> userId;
            }
            @Override
            public boolean isUserInRole(String r) {
                return userRole != null && userRole.equals(r);
            }
            @Override
            public boolean isSecure() {
                return requestContext.getSecurityContext().isSecure();
            }
            @Override
            public String getAuthenticationScheme() {
                return "Bearer";
            }
        });
    }

    private String extractBusinessId(ContainerRequestContext requestContext) {
        // Check query parameters first
        String businessId = requestContext.getUriInfo().getQueryParameters().getFirst("businessId");
        if (businessId != null && !businessId.isBlank()) {
            return businessId;
        }

        // Check request body for JSON with businessId
        if (requestContext.hasEntity() && requestContext.getMediaType() != null &&
            requestContext.getMediaType().toString().contains("json")) {
            try {
                InputStream entityStream = requestContext.getEntityStream();
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                entityStream.transferTo(baos);
                byte[] bodyBytes = baos.toByteArray();

                // Reset the entity stream so downstream can read it
                requestContext.setEntityStream(new ByteArrayInputStream(bodyBytes));

                String body = new String(bodyBytes, StandardCharsets.UTF_8);
                return AuthService.extractJsonField(body, "businessId");
            } catch (Exception e) {
                // If we can't read the body, skip businessId check
                return null;
            }
        }

        return null;
    }
}
