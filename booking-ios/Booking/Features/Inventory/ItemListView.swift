import SwiftUI

struct ItemListView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @ObservedObject var vm: InventoryViewModel
    @StateObject private var salesVM = SalesViewModel()
    @State private var showAddSheet = false
    @State private var searchText = ""
    @State private var sellItem: Item?

    private var filteredItems: [Item] {
        vm.filteredItems(searchText: searchText)
    }

    var body: some View {
        Group {
            if vm.isLoading && vm.items.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if vm.isEmpty {
                // PARITY FIX: empty state matches web "Add your first item"
                VStack(spacing: AppTheme.Spacing.md) {
                    Image(systemName: "shippingbox")
                        .font(.system(size: 48))
                        .foregroundStyle(AppTheme.Colors.textMuted)
                    Text("No items yet")
                        .font(AppTheme.Typography.heading)
                        .foregroundStyle(AppTheme.Colors.text)
                    Text("Add your first item to get started.")
                        .font(AppTheme.Typography.bodySmall)
                        .foregroundStyle(AppTheme.Colors.textMuted)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(filteredItems) { item in
                        HStack {
                            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                                Text(item.name)
                                    .font(AppTheme.Typography.body)
                                    .foregroundStyle(AppTheme.Colors.text)
                                Text(item.brand)
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textMuted)
                            }
                            Spacer()
                            Text(item.purchasePrice.value.currencyFormatted())
                                .font(AppTheme.Typography.bodySmall)
                                .foregroundStyle(AppTheme.Colors.textMuted)
                            StatusBadge(status: item.status)
                        }
                        .listRowBackground(AppTheme.Colors.surface)
                        .swipeActions(edge: .leading) {
                            if item.status == "AVAILABLE" {
                                Button {
                                    sellItem = item
                                } label: {
                                    Label("Sell", systemImage: "dollarsign")
                                }
                                .tint(AppTheme.Colors.gold)
                            }
                        }
                        .swipeActions(edge: .trailing) {
                            if vm.canDelete(item) && authVM.role == "ADMIN" {
                                Button(role: .destructive) {
                                    Task { await vm.deleteItem(item) }
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                }
                .searchable(text: $searchText, prompt: "Search name or brand")
                .refreshable { await vm.fetchItems() }
            }
        }
        .background(AppTheme.Colors.bg)
        .overlay(alignment: .top) {
            if let error = vm.errorMessage {
                // PARITY FIX: error banner red bg + white text matching web
                Text(error)
                    .font(AppTheme.Typography.caption)
                    .foregroundStyle(.white)
                    .padding(AppTheme.Spacing.sm)
                    .frame(maxWidth: .infinity)
                    .background(AppTheme.Colors.loss)
                    .cornerRadius(AppTheme.Radius.md)
                    .padding(.horizontal, AppTheme.Spacing.md)
                    .onTapGesture { vm.errorMessage = nil }
            }
        }
        .toolbar {
            if authVM.role == "ADMIN" || authVM.role == "BUYER" {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showAddSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(AppTheme.Colors.gold)
                    }
                }
            }
        }
        .sheet(isPresented: $showAddSheet) {
            AddItemSheet(vm: vm)
        }
        .sheet(item: $sellItem) { item in
            RecordSaleSheet(vm: salesVM, inventoryVM: vm)
        }
        .task { await vm.fetchItems() }
    }
}

struct StatusBadge: View {
    let status: String

    private var displayText: String {
        switch status {
        case "AVAILABLE": return "Available"
        case "SOLD": return "Sold"
        default: return status.prefix(1).uppercased() + status.dropFirst().lowercased()
        }
    }

    private var dotColor: Color {
        status == "AVAILABLE" ? AppTheme.Colors.profit : AppTheme.Colors.textMuted
    }

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(dotColor)
                .frame(width: 6, height: 6)
            Text(displayText)
                .font(AppTheme.Typography.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, AppTheme.Spacing.sm)
        .padding(.vertical, AppTheme.Spacing.xs)
        .background(status == "AVAILABLE" ? AppTheme.Colors.profit.opacity(0.15) : AppTheme.Colors.textMuted.opacity(0.15))
        .foregroundStyle(status == "AVAILABLE" ? AppTheme.Colors.profit : AppTheme.Colors.textMuted)
        .cornerRadius(AppTheme.Radius.sm)
    }
}
