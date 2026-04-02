package com.bookingplatform.imports;

import com.bookingplatform.imports.dto.*;
import com.bookingplatform.imports.model.ImportError;
import com.bookingplatform.imports.model.ImportRow;
import com.bookingplatform.imports.model.ParseResult;
import com.bookingplatform.imports.model.Platform;
import com.bookingplatform.model.Item;
import com.bookingplatform.model.ItemStatus;
import com.bookingplatform.model.Sale;
import com.bookingplatform.repository.ItemRepository;
import com.bookingplatform.repository.SaleRepository;
import com.bookingplatform.util.MoneyUtils;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Orchestrates CSV import: parsing, duplicate detection, and bulk insert of Items + Sales.
 */
@ApplicationScoped
public class ImportService {

    @Inject CsvParserFactory csvParserFactory;
    @Inject SaleRepository saleRepository;
    @Inject ItemRepository itemRepository;

    /**
     * Parses a CSV file and returns a preview with duplicate detection.
     * Does not persist anything — preview is read-only.
     *
     * @param platform   the platform this CSV is from
     * @param csv        the CSV input stream
     * @param businessId the tenant ID from JWT
     * @return preview response with parsed rows, duplicate flags, and error details
     */
    public ImportPreviewResponse preview(Platform platform, InputStream csv, String businessId) {
        ParseResult result;
        try {
            result = csvParserFactory.getParser(platform).parse(csv);
        } catch (ImportParseException ex) {
            return new ImportPreviewResponse(
                platform.name(), 0, 0, 0, 1, 2000,
                List.of(),
                List.of(new ImportErrorDto(-1, "file", ex.getMessage()))
            );
        }

        List<ImportRow> rows = result.rows();
        List<ImportError> errors = result.errors();

        // Batch duplicate check (single MongoDB query)
        Set<String> orderIds = rows.stream()
            .map(ImportRow::externalOrderId)
            .filter(id -> id != null && !id.isBlank())
            .collect(Collectors.toSet());

        Set<String> duplicateIds = Set.of();
        if (!orderIds.isEmpty()) {
            List<Sale> existing = saleRepository.list(
                "businessId = ?1 and platform = ?2 and externalOrderId in ?3",
                businessId, platform.name(), orderIds);
            duplicateIds = existing.stream()
                .map(s -> s.externalOrderId)
                .collect(Collectors.toSet());
        }

        // Build row DTOs with duplicate flags
        List<ImportRowDto> rowDtos = new ArrayList<>(rows.size());
        int duplicateCount = 0;
        for (ImportRow row : rows) {
            boolean isDuplicate = duplicateIds.contains(row.externalOrderId());
            if (isDuplicate) duplicateCount++;
            rowDtos.add(new ImportRowDto(
                row.rowNumber(), row.externalOrderId(), row.title(), row.saleDate(),
                row.salePrice(), row.platformFees(), row.netProceeds(), isDuplicate
            ));
        }

        List<ImportErrorDto> errorDtos = errors.stream()
            .map(e -> new ImportErrorDto(e.rowNumber(), e.field(), e.message()))
            .toList();

        return new ImportPreviewResponse(
            platform.name(),
            rows.size() + errors.size(),
            rows.size(),
            duplicateCount,
            errors.size(),
            2000,
            rowDtos,
            errorDtos
        );
    }

    /**
     * Confirms and persists the import: creates Item + Sale for each valid, non-duplicate row.
     * Performs server-side re-validation and duplicate re-check. Partial success is allowed.
     *
     * @param platform   the platform these rows belong to
     * @param rows       the rows from the client (from preview response)
     * @param businessId the tenant ID from JWT
     * @return result with counts of imported, skipped duplicates, and errors
     * @throws WebApplicationException 400 if rows exceed 2000
     */
    public ImportResultResponse confirm(Platform platform, List<ImportRowDto> rows, String businessId) {
        if (rows.size() > 2000) {
            throw new WebApplicationException("Row limit is 2000", 400);
        }

        int batchErrors = 0;

        // Server-side re-validation
        List<ImportRowDto> validRows = new ArrayList<>();
        for (ImportRowDto row : rows) {
            if (row.salePrice() == null || row.salePrice().compareTo(BigDecimal.ZERO) <= 0) {
                batchErrors++;
                continue;
            }
            if (row.platformFees() == null || row.platformFees().compareTo(BigDecimal.ZERO) < 0) {
                batchErrors++;
                continue;
            }
            if (row.platformFees().compareTo(row.salePrice()) >= 0) {
                batchErrors++;
                continue;
            }
            // Recompute netProceeds server-side
            BigDecimal serverNetProceeds = row.salePrice().subtract(row.platformFees());
            validRows.add(new ImportRowDto(
                row.rowNumber(), row.externalOrderId(), row.title(), row.saleDate(),
                row.salePrice(), row.platformFees(), serverNetProceeds, row.isDuplicate()
            ));
        }

        // Batch duplicate re-check
        Set<String> orderIds = validRows.stream()
            .map(ImportRowDto::externalOrderId)
            .filter(id -> id != null && !id.isBlank())
            .collect(Collectors.toSet());

        Set<String> duplicateIds = Set.of();
        if (!orderIds.isEmpty()) {
            List<Sale> existing = saleRepository.list(
                "businessId = ?1 and platform = ?2 and externalOrderId in ?3",
                businessId, platform.name(), orderIds);
            duplicateIds = existing.stream()
                .map(s -> s.externalOrderId)
                .collect(Collectors.toSet());
        }

        List<ImportRowDto> toInsert = new ArrayList<>();
        int skippedDuplicates = 0;
        for (ImportRowDto row : validRows) {
            if (duplicateIds.contains(row.externalOrderId())) {
                skippedDuplicates++;
            } else {
                toInsert.add(row);
            }
        }

        if (toInsert.isEmpty()) {
            return new ImportResultResponse(0, skippedDuplicates, 0, batchErrors);
        }

        // Build Items
        List<Item> itemList = new ArrayList<>(toInsert.size());
        for (ImportRowDto row : toInsert) {
            Item item = new Item();
            item.name = row.title();
            item.notes = "Imported from " + platform.name();
            item.description = "";
            item.businessId = businessId;
            item.costEntryPending = true;
            item.purchasePrice = MoneyUtils.toDecimal128(BigDecimal.ZERO);
            item.purchaseDate = row.saleDate() != null
                ? row.saleDate().minusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()
                : null;
            item.status = ItemStatus.AVAILABLE;
            item.createdAt = Instant.now();
            item.updatedAt = Instant.now();
            itemList.add(item);
        }

        // Bulk insert Items
        try {
            itemRepository.persist(itemList);
        } catch (Exception e) {
            // Count failed items as batch errors
            batchErrors += toInsert.size();
            return new ImportResultResponse(0, skippedDuplicates, 0, batchErrors);
        }

        // Build Sales using now-populated item IDs
        List<Sale> saleList = new ArrayList<>(toInsert.size());
        for (int i = 0; i < toInsert.size(); i++) {
            ImportRowDto row = toInsert.get(i);
            Sale sale = new Sale();
            sale.businessId = businessId;
            sale.platform = platform.name();
            sale.externalOrderId = row.externalOrderId();
            sale.itemId = itemList.get(i).id.toString();
            sale.salePrice = MoneyUtils.toDecimal128(row.salePrice());
            sale.platformFees = MoneyUtils.toDecimal128(row.platformFees());
            sale.netProceeds = MoneyUtils.toDecimal128(row.netProceeds());
            sale.profit = MoneyUtils.toDecimal128(row.netProceeds());
            sale.soldAt = row.saleDate() != null
                ? row.saleDate().atStartOfDay(ZoneOffset.UTC).toInstant()
                : Instant.now();
            sale.createdAt = Instant.now();
            saleList.add(sale);
        }

        // Bulk insert Sales
        try {
            saleRepository.persist(saleList);
        } catch (Exception e) {
            batchErrors += toInsert.size();
            return new ImportResultResponse(0, skippedDuplicates, 0, batchErrors);
        }

        int imported = toInsert.size();
        return new ImportResultResponse(imported, skippedDuplicates, imported, batchErrors);
    }
}
