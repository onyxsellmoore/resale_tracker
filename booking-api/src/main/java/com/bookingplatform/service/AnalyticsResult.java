package com.bookingplatform.service;

import java.math.BigDecimal;
import java.util.List;

public record AnalyticsResult(
        Summary summary,
        List<PlatformBreakdown> byPlatform,
        List<CategoryBreakdown> byCategory,
        List<MonthBreakdown> byMonth
) {

    public record Summary(
            int itemsSold,
            BigDecimal totalRevenue,
            BigDecimal totalFees,
            BigDecimal totalNetProceeds,
            BigDecimal totalCostOfGoods,
            BigDecimal totalProfit,
            double averageMargin
    ) {}

    public record PlatformBreakdown(
            String platform,
            int itemsSold,
            BigDecimal totalRevenue,
            BigDecimal totalProfit
    ) {}

    public record CategoryBreakdown(
            String category,
            int itemsSold,
            BigDecimal totalRevenue,
            BigDecimal totalProfit
    ) {}

    public record MonthBreakdown(
            String month,
            int itemsSold,
            BigDecimal totalRevenue,
            BigDecimal totalProfit
    ) {}
}
