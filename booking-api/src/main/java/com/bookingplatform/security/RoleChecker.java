package com.bookingplatform.security;

import java.util.Map;
import java.util.Set;

/**
 * Centralized role-permission lookup backed by Set.of() for O(1) checks.
 * Replaces scattered hasRole() linear scans across resource classes.
 */
public final class RoleChecker {

    private RoleChecker() {}

    /** Endpoint operation keys */
    public static final String CREATE_ITEM = "CREATE_ITEM";
    public static final String DELETE_ITEM = "DELETE_ITEM";
    public static final String CREATE_SALE = "CREATE_SALE";
    public static final String UPDATE_SALE = "UPDATE_SALE";
    public static final String DELETE_SALE = "DELETE_SALE";
    public static final String VIEW_ANALYTICS = "VIEW_ANALYTICS";
    public static final String MANAGE_USERS = "MANAGE_USERS";

    private static final Map<String, Set<String>> OPERATION_ROLES = Map.of(
        CREATE_ITEM, Set.of("ADMIN", "BUYER"),
        DELETE_ITEM, Set.of("ADMIN"),
        CREATE_SALE, Set.of("ADMIN", "SELLER"),
        UPDATE_SALE, Set.of("ADMIN", "SELLER"),
        DELETE_SALE, Set.of("ADMIN", "SELLER"),
        VIEW_ANALYTICS, Set.of("ADMIN", "ACCOUNTANT"),
        MANAGE_USERS, Set.of("ADMIN")
    );

    /**
     * Check if the given role is allowed for the specified operation.
     * Returns true if role is null (security disabled) or if role is in the allowed set.
     */
    public static boolean can(String role, String operation) {
        if (role == null) return true; // No role enforcement when security is disabled
        Set<String> allowed = OPERATION_ROLES.get(operation);
        return allowed != null && allowed.contains(role);
    }
}
