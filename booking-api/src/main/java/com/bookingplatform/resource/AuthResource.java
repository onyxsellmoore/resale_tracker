package com.bookingplatform.resource;

import com.bookingplatform.model.User;
import com.bookingplatform.repository.UserRepository;
import com.bookingplatform.service.AuthService;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.Map;
import java.util.Optional;

@Path("/api/v1/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AuthResource {

    @Inject
    AuthService authService;

    @Inject
    UserRepository userRepository;

    @ConfigProperty(name = "booking.dev-token.enabled", defaultValue = "false")
    boolean devTokenEnabled;

    public record LoginBeginRequest(String email) {}
    public record LoginCompleteRequest(String email, String credentialId,
                                        String authenticatorData, String clientDataJSON,
                                        String signature) {}
    public record RefreshRequest(String refreshToken) {}
    public record LogoutRequest(String refreshToken) {}
    public record AuthResponse(String accessToken, String refreshToken) {}
    public record ErrorResponse(String message) {}

    public record RegisterRequest(String orgName, String orgSlug, String adminEmail,
                                   String adminDisplayName) {}
    public record RegisterResponse(String orgId, String userId, String role) {}

    public record RegisterBeginRequest(String email) {}
    public record RegisterCompleteRequest(String email, String credentialId,
                                           String attestationObject, String clientDataJSON) {}

    @POST
    @Path("/register")
    public Response register(RegisterRequest request) {
        if (request == null || request.orgName() == null || request.orgSlug() == null
            || request.adminEmail() == null || request.adminDisplayName() == null) {
            return Response.status(400).entity(new ErrorResponse("All fields are required")).build();
        }

        Optional<AuthService.RegisterResult> result = authService.register(
                request.orgName(), request.orgSlug(), request.adminEmail(),
                request.adminDisplayName());

        if (result.isEmpty()) {
            return Response.status(409).entity(new ErrorResponse("Organization slug already taken")).build();
        }

        AuthService.RegisterResult reg = result.get();
        return Response.status(201).entity(
                new RegisterResponse(reg.orgId(), reg.userId(), reg.role())).build();
    }

    @POST
    @Path("/register/begin")
    public Response registerBegin(RegisterBeginRequest request) {
        if (request == null || request.email() == null || request.email().isBlank()) {
            return Response.status(401).entity(new ErrorResponse("Authentication failed")).build();
        }

        Optional<Map<String, Object>> options = authService.registerBegin(request.email());
        if (options.isEmpty()) {
            return Response.status(401).entity(new ErrorResponse("Authentication failed")).build();
        }

        return Response.ok(options.get()).build();
    }

    @POST
    @Path("/register/complete")
    public Response registerComplete(RegisterCompleteRequest request) {
        if (request == null || request.email() == null) {
            return Response.status(401).entity(new ErrorResponse("Authentication failed")).build();
        }

        Optional<AuthService.TokenPair> tokens = authService.registerComplete(
                request.email(), request.credentialId(),
                request.attestationObject(), request.clientDataJSON());

        if (tokens.isEmpty()) {
            return Response.status(401).entity(new ErrorResponse("Authentication failed")).build();
        }

        AuthService.TokenPair pair = tokens.get();
        return Response.ok(new AuthResponse(pair.accessToken(), pair.refreshToken())).build();
    }

    @POST
    @Path("/login/begin")
    public Response loginBegin(LoginBeginRequest request) {
        if (request == null || request.email() == null || request.email().isBlank()) {
            return Response.status(401).entity(new ErrorResponse("Authentication failed")).build();
        }

        AuthService.LoginBeginResult result = authService.loginBeginWithStatus(request.email());
        if (result.status() == AuthService.LoginBeginStatus.USER_NOT_FOUND) {
            return Response.status(401).entity(new ErrorResponse("Authentication failed")).build();
        }
        if (result.status() == AuthService.LoginBeginStatus.NO_PASSKEY) {
            return Response.status(409).entity(new ErrorResponse("no_passkey")).build();
        }
        return Response.ok(result.options()).build();
    }

    public record PasswordLoginRequest(String email, String password) {}

    @POST
    @Path("/login/password")
    public Response loginWithPassword(PasswordLoginRequest request) {
        if (request == null || request.email() == null || request.password() == null) {
            return Response.status(401).entity(new ErrorResponse("Authentication failed")).build();
        }
        Optional<AuthService.TokenPair> tokens = authService.loginWithPassword(request.email(), request.password());
        if (tokens.isEmpty()) {
            return Response.status(401).entity(new ErrorResponse("Invalid email or password")).build();
        }
        AuthService.TokenPair pair = tokens.get();
        return Response.ok(new AuthResponse(pair.accessToken(), pair.refreshToken())).build();
    }

    @POST
    @Path("/login/complete")
    public Response loginComplete(LoginCompleteRequest request) {
        if (request == null || request.email() == null) {
            return Response.status(401).entity(new ErrorResponse("Authentication failed")).build();
        }

        Optional<AuthService.TokenPair> tokens = authService.loginComplete(
                request.email(), request.credentialId(),
                request.authenticatorData(), request.clientDataJSON(),
                request.signature());

        if (tokens.isEmpty()) {
            return Response.status(401).entity(new ErrorResponse("Authentication failed")).build();
        }

        AuthService.TokenPair pair = tokens.get();
        return Response.ok(new AuthResponse(pair.accessToken(), pair.refreshToken())).build();
    }

    @POST
    @Path("/refresh")
    public Response refresh(RefreshRequest request) {
        if (request == null || request.refreshToken() == null) {
            return Response.status(401).entity(new ErrorResponse("Invalid refresh token")).build();
        }

        Optional<String> newAccessToken = authService.refresh(request.refreshToken());
        if (newAccessToken.isEmpty()) {
            return Response.status(401).entity(new ErrorResponse("Invalid refresh token")).build();
        }

        return Response.ok(Map.of("accessToken", newAccessToken.get())).build();
    }

    @POST
    @Path("/logout")
    public Response logout(LogoutRequest request) {
        if (request != null && request.refreshToken() != null) {
            authService.logout(request.refreshToken());
        }
        return Response.noContent().build();
    }

    public record DevTokenRequest(String email) {}

    @POST
    @Path("/dev-token")
    public Response devToken(DevTokenRequest request) {
        if (!devTokenEnabled) {
            return Response.status(404).build();
        }
        if (request == null || request.email() == null || request.email().isBlank()) {
            return Response.status(400).entity(new ErrorResponse("email is required")).build();
        }

        Optional<User> user = userRepository.findByEmail(request.email());
        if (user.isEmpty()) {
            return Response.status(404).entity(new ErrorResponse("User not found")).build();
        }

        String token = authService.generateUserJwt(user.get());
        return Response.ok(Map.of("accessToken", token)).build();
    }
}
