import SwiftUI

struct SalesListView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @ObservedObject var vm: SalesViewModel
    @State private var showRecordSheet = false
    @State private var searchText = ""
    @ObservedObject var inventoryVM: InventoryViewModel

    private var filteredSales: [Sale] {
        vm.filteredSales(searchText: searchText)
    }

    var body: some View {
        Group {
            if vm.isLoading && vm.sales.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if vm.sales.isEmpty {
                VStack(spacing: AppTheme.Spacing.md) {
                    Image(systemName: "dollarsign.circle")
                        .font(.system(size: 48))
                        .foregroundStyle(AppTheme.Colors.textMuted)
                    Text("No sales yet")
                        .font(AppTheme.Typography.heading)
                        .foregroundStyle(AppTheme.Colors.text)
                    Text("Record your first sale to start tracking profit.")
                        .font(AppTheme.Typography.bodySmall)
                        .foregroundStyle(AppTheme.Colors.textMuted)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(filteredSales) { sale in
                        HStack {
                            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                                Text(sale.platform)
                                    .font(AppTheme.Typography.body)
                                    .foregroundStyle(AppTheme.Colors.text)
                                Text(sale.salePrice.value.currencyFormatted())
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textMuted)
                            }
                            Spacer()
                            Image(systemName: sale.profit.value >= 0 ? "arrow.up" : "arrow.down")
                                .foregroundStyle(sale.profit.value >= 0 ? AppTheme.Colors.profit : AppTheme.Colors.loss)
                            Text(sale.profit.value.currencyFormatted())
                                .font(AppTheme.Typography.body)
                                .foregroundStyle(sale.profit.value >= 0 ? AppTheme.Colors.profit : AppTheme.Colors.loss)
                        }
                        .listRowBackground(AppTheme.Colors.surface)
                    }
                }
                .searchable(text: $searchText, prompt: "Search platform or item")
                .refreshable { await vm.fetchSales() }
            }
        }
        .background(AppTheme.Colors.bg)
        .toolbar {
            if authVM.role == "ADMIN" || authVM.role == "SELLER" {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showRecordSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(AppTheme.Colors.gold)
                    }
                }
            }
        }
        .sheet(isPresented: $showRecordSheet) {
            RecordSaleSheet(vm: vm, inventoryVM: inventoryVM)
        }
        .task { await vm.fetchSales() }
    }
}
