import SwiftUI

struct ItemListView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @ObservedObject var vm: InventoryViewModel
    @State private var showAddSheet = false

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
                    ForEach(vm.items) { item in
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
                            StatusBadge(status: item.status)
                        }
                        .listRowBackground(AppTheme.Colors.surface)
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
        .task { await vm.fetchItems() }
    }
}

struct StatusBadge: View {
    let status: String

    var body: some View {
        Text(status)
            .font(AppTheme.Typography.caption)
            .fontWeight(.medium)
            .padding(.horizontal, AppTheme.Spacing.sm)
            .padding(.vertical, AppTheme.Spacing.xs)
            .background(status == "AVAILABLE" ? AppTheme.Colors.profit.opacity(0.15) : AppTheme.Colors.textMuted.opacity(0.15))
            .foregroundStyle(status == "AVAILABLE" ? AppTheme.Colors.profit : AppTheme.Colors.textMuted)
            .cornerRadius(AppTheme.Radius.sm)
    }
}
