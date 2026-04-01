package com.bookingplatform.imports;

import com.bookingplatform.imports.model.Platform;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;

import java.util.stream.StreamSupport;

/**
 * Resolves the {@link CsvParser} for a given {@link Platform}.
 * New platforms register automatically by implementing CsvParser with {@code @ApplicationScoped}.
 */
@ApplicationScoped
public class CsvParserFactory {

    @Inject
    Instance<CsvParser> parsers;

    /**
     * Returns the parser registered for the given platform.
     *
     * @param platform the target platform
     * @return the matching {@link CsvParser}
     * @throws ImportParseException if no parser is registered for the platform
     */
    public CsvParser getParser(Platform platform) {
        return StreamSupport.stream(parsers.spliterator(), false)
            .filter(p -> p.getPlatform() == platform)
            .findFirst()
            .orElseThrow(() ->
                new ImportParseException("No CSV parser registered for platform: " + platform));
    }
}
