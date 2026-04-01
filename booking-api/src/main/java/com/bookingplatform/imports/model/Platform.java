package com.bookingplatform.imports.model;

/**
 * Supported marketplace platforms for sale imports.
 * Use {@code platform.name()} when persisting to MongoDB; {@code Platform.valueOf(string)} when reading.
 */
public enum Platform {
    EBAY, POSHMARK, MERCARI
}
