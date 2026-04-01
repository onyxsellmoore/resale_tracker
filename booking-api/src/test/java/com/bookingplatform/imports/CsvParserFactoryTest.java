package com.bookingplatform.imports;

import com.bookingplatform.imports.model.Platform;
import jakarta.enterprise.inject.Instance;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Spliterator;
import java.util.Spliterators;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Unit tests for {@link CsvParserFactory}.
 * Uses a manual mock of {@link Instance} to avoid CDI dependency.
 */
class CsvParserFactoryTest {

    /**
     * Verifies that the factory returns the correct parser for EBAY.
     */
    @Test
    void getParser_ebay_returnsEbayCsvParser() {
        CsvParserFactory factory = createFactory(
            new EbayCsvParser(), new PoshmarkCsvParser(), new MercariCsvParser());
        CsvParser parser = factory.getParser(Platform.EBAY);
        assertEquals(Platform.EBAY, parser.getPlatform());
    }

    /**
     * Verifies that the factory returns the correct parser for POSHMARK.
     */
    @Test
    void getParser_poshmark_returnsPoshmarkCsvParser() {
        CsvParserFactory factory = createFactory(
            new EbayCsvParser(), new PoshmarkCsvParser(), new MercariCsvParser());
        CsvParser parser = factory.getParser(Platform.POSHMARK);
        assertEquals(Platform.POSHMARK, parser.getPlatform());
    }

    /**
     * Verifies that the factory returns the correct parser for MERCARI.
     */
    @Test
    void getParser_mercari_returnsMercariCsvParser() {
        CsvParserFactory factory = createFactory(
            new EbayCsvParser(), new PoshmarkCsvParser(), new MercariCsvParser());
        CsvParser parser = factory.getParser(Platform.MERCARI);
        assertEquals(Platform.MERCARI, parser.getPlatform());
    }

    /**
     * Verifies that requesting a parser for an unregistered platform throws ImportParseException.
     */
    @Test
    void getParser_unknownPlatform_throwsImportParseException() {
        CsvParserFactory factory = createFactory(); // no parsers registered
        assertThrows(ImportParseException.class, () -> factory.getParser(Platform.EBAY));
    }

    /**
     * Creates a CsvParserFactory with the given parsers injected manually.
     *
     * @param parserList the parsers to register
     * @return a configured factory
     */
    private CsvParserFactory createFactory(CsvParser... parserList) {
        CsvParserFactory factory = new CsvParserFactory();
        factory.parsers = new StubInstance(List.of(parserList));
        return factory;
    }

    /**
     * Minimal stub of {@link Instance} for testing without CDI.
     */
    private static class StubInstance implements Instance<CsvParser> {
        private final List<CsvParser> list;

        StubInstance(List<CsvParser> list) {
            this.list = list;
        }

        @Override
        public Spliterator<CsvParser> spliterator() {
            return Spliterators.spliteratorUnknownSize(list.iterator(), 0);
        }

        @Override
        public java.util.Iterator<CsvParser> iterator() {
            return list.iterator();
        }

        // Unused Instance methods — not needed for this test
        @Override public Instance<CsvParser> select(java.lang.annotation.Annotation... qualifiers) { throw new UnsupportedOperationException(); }
        @Override public <U extends CsvParser> Instance<U> select(Class<U> subtype, java.lang.annotation.Annotation... qualifiers) { throw new UnsupportedOperationException(); }
        @Override public <U extends CsvParser> Instance<U> select(jakarta.enterprise.util.TypeLiteral<U> subtype, java.lang.annotation.Annotation... qualifiers) { throw new UnsupportedOperationException(); }
        @Override public boolean isUnsatisfied() { return list.isEmpty(); }
        @Override public boolean isAmbiguous() { return list.size() > 1; }
        @Override public void destroy(CsvParser instance) {}
        @Override public Handle<CsvParser> getHandle() { throw new UnsupportedOperationException(); }
        @Override public Iterable<? extends Handle<CsvParser>> handles() { throw new UnsupportedOperationException(); }
        @Override public CsvParser get() { return list.getFirst(); }
        @Override public boolean isResolvable() { return list.size() == 1; }
    }
}
