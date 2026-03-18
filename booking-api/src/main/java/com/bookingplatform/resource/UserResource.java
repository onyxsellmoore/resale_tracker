package com.bookingplatform.resource;

import com.bookingplatform.model.Role;
import com.bookingplatform.model.User;
import com.bookingplatform.repository.UserRepository;
import com.mongodb.MongoWriteException;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.bson.types.ObjectId;

import java.time.Instant;
import java.util.List;

@Path("/api/v1/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserResource {

    @Inject
    UserRepository userRepository;

    @Context
    ContainerRequestContext requestContext;

    public record CreateUserRequest(String email, String displayName, String role) {}
    public record UserResponse(String id, String email, String displayName, String role, String orgId, String createdAt) {}

    @POST
    public Response createUser(CreateUserRequest request) {
        String callerRole = (String) requestContext.getProperty("role");
        if (!"ADMIN".equals(callerRole)) {
            return Response.status(403).entity("{\"message\":\"Forbidden\"}").type("application/json").build();
        }

        String orgId = (String) requestContext.getProperty("orgId");

        if (request == null || request.email() == null || request.displayName() == null
                || request.role() == null) {
            return Response.status(400).entity("{\"message\":\"All fields required\"}").type("application/json").build();
        }

        Role role;
        try {
            role = Role.valueOf(request.role());
        } catch (IllegalArgumentException e) {
            return Response.status(400).entity("{\"message\":\"Invalid role\"}").type("application/json").build();
        }

        User user = new User();
        user.orgId = new ObjectId(orgId);
        user.email = request.email();
        user.displayName = request.displayName();
        user.role = role;
        user.createdAt = Instant.now();
        try {
            userRepository.persist(user);
        } catch (MongoWriteException e) {
            if (e.getError().getCode() == 11000) {
                return Response.status(409).entity("{\"message\":\"Email already exists\"}").type("application/json").build();
            }
            throw e;
        }

        return Response.status(201).entity(toResponse(user)).build();
    }

    @GET
    public Response listUsers() {
        String callerRole = (String) requestContext.getProperty("role");
        if (!"ADMIN".equals(callerRole)) {
            return Response.status(403).entity("{\"message\":\"Forbidden\"}").type("application/json").build();
        }

        String orgId = (String) requestContext.getProperty("orgId");
        List<User> users = userRepository.findByOrgId(new ObjectId(orgId));

        List<UserResponse> responses = users.stream().map(this::toResponse).toList();
        return Response.ok(responses).build();
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.id.toHexString(),
                user.email,
                user.displayName,
                user.role.name(),
                user.orgId.toHexString(),
                user.createdAt.toString()
        );
    }
}
