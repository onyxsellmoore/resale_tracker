package com.bookingplatform.imports.dto;

import java.util.List;

/**
 * Request body for the import confirm endpoint.
 *
 * @param platform the platform these rows belong to
 * @param rows     the rows to import (from preview response, possibly filtered by client)
 */
public record ImportConfirmRequest(
    String platform,
    List<ImportRowDto> rows
) {}
