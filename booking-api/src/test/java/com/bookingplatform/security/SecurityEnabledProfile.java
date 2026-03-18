package com.bookingplatform.security;

import io.quarkus.test.junit.QuarkusTestProfile;
import java.util.Map;

public class SecurityEnabledProfile implements QuarkusTestProfile {

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of("booking.security.enabled", "true");
    }
}
