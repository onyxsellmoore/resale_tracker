package com.bookingplatform.service;

import com.bookingplatform.model.Item;
import com.bookingplatform.model.Sale;
import com.bookingplatform.repository.ItemRepository;
import com.bookingplatform.repository.SaleRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@ApplicationScoped
public class AnalyticsService {

    @Inject
    SaleRepository saleRepository;

    @Inject
    ItemRepository itemRepository;

    public AnalyticsResult getAnalytics(String businessId, LocalDate from, LocalDate to) {
        // Inclusive range: from start-of-day to end-of-to-day
        Instant start = from.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        List<Sale> sales = saleRepository.findByBusinessAndSoldAtRange(businessId, start, end);

        long pendingCostItemsCount = itemRepository.count("businessId = ?1 and costEntryPending = ?2", businessId, true);

        if (sales.isEmpty()) {
            BigDecimal zero = new BigDecimal("0.00");
            return new AnalyticsResult(
                    new AnalyticsResult.Summary(0, zero, zero, zero, zero, zero, 0.0),
                    List.of(), List.of(), List.of(), pendingCostItemsCount
            );
        }

        // Build a map of itemId -> Item for category lookups
        Map<String, Item> itemMap = sales.stream()
                .map(s -> s.itemId)
                .distinct()
                .collect(Collectors.toMap(
                        id -> id,
                        id -> itemRepository.findById(new org.bson.types.ObjectId(id))
                ));

        // Summary
        BigDecimal totalRevenue = sumField(sales, s -> s.salePrice.bigDecimalValue());
        BigDecimal totalFees = sumField(sales, s -> s.platformFees.bigDecimalValue());
        BigDecimal totalNetProceeds = sumField(sales, s -> s.netProceeds.bigDecimalValue());
        BigDecimal totalProfit = sumField(sales, s -> s.profit.bigDecimalValue());

        BigDecimal totalCostOfGoods = sales.stream()
                .map(s -> {
                    Item item = itemMap.get(s.itemId);
                    return item != null && item.purchasePrice != null
                            ? item.purchasePrice.bigDecimalValue() : BigDecimal.ZERO;
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        double averageMargin = totalRevenue.compareTo(BigDecimal.ZERO) > 0
                ? totalProfit.multiply(new BigDecimal("100"))
                    .divide(totalRevenue, 1, RoundingMode.HALF_UP)
                    .doubleValue()
                : 0.0;

        AnalyticsResult.Summary summary = new AnalyticsResult.Summary(
                sales.size(), totalRevenue, totalFees, totalNetProceeds,
                totalCostOfGoods, totalProfit, averageMargin
        );

        // By platform — sorted by totalProfit descending
        List<AnalyticsResult.PlatformBreakdown> byPlatform = sales.stream()
                .collect(Collectors.groupingBy(s -> s.platform))
                .entrySet().stream()
                .map(e -> new AnalyticsResult.PlatformBreakdown(
                        e.getKey(),
                        e.getValue().size(),
                        sumField(e.getValue(), s -> s.salePrice.bigDecimalValue()),
                        sumField(e.getValue(), s -> s.profit.bigDecimalValue())
                ))
                .sorted(Comparator.comparing(AnalyticsResult.PlatformBreakdown::totalProfit).reversed())
                .toList();

        // By category — sorted by totalProfit descending
        List<AnalyticsResult.CategoryBreakdown> byCategory = sales.stream()
                .collect(Collectors.groupingBy(s -> {
                    Item item = itemMap.get(s.itemId);
                    return item != null && item.category != null ? item.category : "Uncategorized";
                }))
                .entrySet().stream()
                .map(e -> new AnalyticsResult.CategoryBreakdown(
                        e.getKey(),
                        e.getValue().size(),
                        sumField(e.getValue(), s -> s.salePrice.bigDecimalValue()),
                        sumField(e.getValue(), s -> s.profit.bigDecimalValue())
                ))
                .sorted(Comparator.comparing(AnalyticsResult.CategoryBreakdown::totalProfit).reversed())
                .toList();

        // By month — sorted chronologically
        List<AnalyticsResult.MonthBreakdown> byMonth = sales.stream()
                .collect(Collectors.groupingBy(s -> {
                    YearMonth ym = YearMonth.from(s.soldAt.atZone(ZoneOffset.UTC));
                    return ym.toString();
                }))
                .entrySet().stream()
                .map(e -> new AnalyticsResult.MonthBreakdown(
                        e.getKey(),
                        e.getValue().size(),
                        sumField(e.getValue(), s -> s.salePrice.bigDecimalValue()),
                        sumField(e.getValue(), s -> s.profit.bigDecimalValue())
                ))
                .sorted(Comparator.comparing(AnalyticsResult.MonthBreakdown::month))
                .toList();

        return new AnalyticsResult(summary, byPlatform, byCategory, byMonth, pendingCostItemsCount);
    }

    private BigDecimal sumField(List<Sale> sales, java.util.function.Function<Sale, BigDecimal> extractor) {
        return sales.stream()
                .map(extractor)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
