import SwiftUI
import Charts

struct AnalyticsView: View {
    @ObservedObject var vm: AnalyticsViewModel

    var body: some View {
        ScrollView {
            VStack(spacing: AppTheme.Spacing.md) {
                // Date pickers
                HStack(spacing: AppTheme.Spacing.sm) {
                    VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                        Text("From")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textMuted)
                        DatePicker("", selection: $vm.from, displayedComponents: .date)
                            .labelsHidden()
                    }
                    VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                        Text("To")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textMuted)
                        DatePicker("", selection: $vm.to, displayedComponents: .date)
                            .labelsHidden()
                    }
                    Spacer()
                    Button("Fetch") {
                        Task { await vm.fetchAnalytics() }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .frame(width: 80)
                }
                .padding(.horizontal, AppTheme.Spacing.md)

                if vm.isLoading {
                    ProgressView()
                        .frame(maxHeight: .infinity)
                } else if let error = vm.errorMessage {
                    Text(error)
                        .font(AppTheme.Typography.body)
                        .foregroundStyle(AppTheme.Colors.loss)
                        .padding()
                } else if let summary = vm.summary {
                    // Summary cards
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppTheme.Spacing.sm) {
                        SummaryCard(title: "Total Revenue", value: summary.totalRevenue.value.currencyFormatted())
                        SummaryCard(title: "Total Profit", value: summary.totalProfit.value.currencyFormatted(),
                                    valueColor: summary.totalProfit.value >= 0 ? AppTheme.Colors.profit : AppTheme.Colors.loss)
                        SummaryCard(title: "Total Sales", value: "\(summary.totalSales)")
                        SummaryCard(title: "Avg Profit", value: summary.averageProfit.value.currencyFormatted())
                    }
                    .padding(.horizontal, AppTheme.Spacing.md)

                    // Platform chart
                    if !summary.salesByPlatform.isEmpty {
                        VStack(alignment: .leading, spacing: AppTheme.Spacing.sm) {
                            Text("Revenue by Platform")
                                .font(AppTheme.Typography.heading)
                                .foregroundStyle(AppTheme.Colors.text)
                                .padding(.horizontal, AppTheme.Spacing.md)

                            Chart(summary.salesByPlatform, id: \.platform) { item in
                                BarMark(
                                    x: .value("Platform", item.platform),
                                    y: .value("Revenue", NSDecimalNumber(decimal: item.revenue.value).doubleValue)
                                )
                                .foregroundStyle(AppTheme.Colors.gold)
                                .cornerRadius(AppTheme.Radius.sm)
                            }
                            .chartYAxis {
                                AxisMarks(position: .leading)
                            }
                            .frame(height: 200)
                            .padding(.horizontal, AppTheme.Spacing.md)
                        }
                    }
                } else {
                    VStack(spacing: AppTheme.Spacing.md) {
                        Image(systemName: "chart.bar")
                            .font(.system(size: 48))
                            .foregroundStyle(AppTheme.Colors.textMuted)
                        Text("No data for this period")
                            .font(AppTheme.Typography.body)
                            .foregroundStyle(AppTheme.Colors.textMuted)
                    }
                    .padding(.top, AppTheme.Spacing.xl)
                }
            }
            .padding(.top, AppTheme.Spacing.md)
        }
        .background(AppTheme.Colors.bg)
        .task { await vm.fetchAnalytics() }
    }
}

struct SummaryCard: View {
    let title: String
    let value: String
    var valueColor: Color = AppTheme.Colors.text

    var body: some View {
        VStack(spacing: AppTheme.Spacing.xs) {
            Text(title)
                .font(AppTheme.Typography.caption)
                .foregroundStyle(AppTheme.Colors.textMuted)
            Text(value)
                .font(AppTheme.Typography.heading)
                .foregroundStyle(valueColor)
        }
        .frame(maxWidth: .infinity)
        .padding(AppTheme.Spacing.md)
        .background(AppTheme.Colors.surface)
        .cornerRadius(AppTheme.Radius.md)
        .overlay(
            RoundedRectangle(cornerRadius: AppTheme.Radius.md)
                .stroke(AppTheme.Colors.border, lineWidth: 1)
        )
    }
}
