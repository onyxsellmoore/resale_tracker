package com.bookingplatform.security;

import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.container.PreMatching;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.Set;

/**
 * Custom CORS filter — Quarkus built-in CORS handler does not fire
 * reliably on Cloud Run, so we handle it at the JAX-RS layer.
 *
 * PreMatching ensures this runs before JAX-RS route matching so that
 * OPTIONS preflight requests are handled before the default OPTIONS
 * handler responds.
 */
@Provider
@PreMatching
@Priority(Priorities.AUTHENTICATION - 1)
public class CorsFilter implements ContainerRequestFilter, ContainerResponseFilter {

    @ConfigProperty(name = "booking.cors.origins", defaultValue = "http://localhost:5173")
    Set<String> allowedOrigins;

    @ConfigProperty(name = "booking.cors.methods", defaultValue = "GET,POST,PATCH,DELETE,OPTIONS")
    Set<String> allowedMethods;

    @ConfigProperty(name = "booking.cors.headers", defaultValue = "Content-Type,Authorization")
    Set<String> allowedHeaders;

    @Override
    public void filter(ContainerRequestContext request) {
        String origin = request.getHeaderString("Origin");
        if (origin == null) {
            return;
        }
        if ("OPTIONS".equalsIgnoreCase(request.getMethod()) && isAllowed(origin)) {
            request.abortWith(Response.ok()
                    .header("Access-Control-Allow-Origin", origin)
                    .header("Access-Control-Allow-Methods", String.join(",", allowedMethods))
                    .header("Access-Control-Allow-Headers", String.join(",", allowedHeaders))
                    .header("Access-Control-Allow-Credentials", "true")
                    .header("Access-Control-Max-Age", "86400")
                    .build());
        }
    }

    @Override
    public void filter(ContainerRequestContext request, ContainerResponseContext response) {
        String origin = request.getHeaderString("Origin");
        if (origin == null || !isAllowed(origin)) {
            return;
        }
        response.getHeaders().putSingle("Access-Control-Allow-Origin", origin);
        response.getHeaders().putSingle("Access-Control-Allow-Credentials", "true");
        response.getHeaders().putSingle("Access-Control-Expose-Headers", "Content-Type,Authorization");
    }

    private boolean isAllowed(String origin) {
        return allowedOrigins.contains(origin);
    }
}
