import SwiftUI

struct RecordSaleSheet: View {
    @ObservedObject var vm: SalesViewModel
    @ObservedObject var inventoryVM: InventoryViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var selectedItemId = ""
    @State private var platform = ""
    @State private var salePrice = ""
    @State private var platformFees = ""

    private var salePriceDecimal: Decimal { Decimal(string: salePrice) ?? .zero }
    private var feesDecimal: Decimal { Decimal(string: platformFees) ?? .zero }
    private var feesExceedPrice: Bool { feesDecimal > salePriceDecimal && salePriceDecimal > 0 }

    private var isFormValid: Bool {
        !selectedItemId.isEmpty && !platform.isEmpty && salePriceDecimal > 0 && !feesExceedPrice
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppTheme.Spacing.md) {
                    if inventoryVM.availableItems.isEmpty {
                        Text("No available items. Add items first.")
                            .font(AppTheme.Typography.body)
                            .foregroundStyle(AppTheme.Colors.textMuted)
                            .padding(.top, AppTheme.Spacing.xl)
                    } else {
                        VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                            Text("Item")
                                .font(AppTheme.Typography.caption)
                                .foregroundStyle(AppTheme.Colors.textMuted)
                            Picker("Item", selection: $selectedItemId) {
                                Text("Select an item").tag("")
                                ForEach(inventoryVM.availableItems) { item in
                                    Text("\(item.name) — \(item.brand)").tag(item.id)
                                }
                            }
                            .pickerStyle(.menu)
                        }

                        ThemedTextField(label: "Platform", text: $platform, placeholder: "eBay, Poshmark, etc.")
                        ThemedTextField(label: "Sale Price", text: $salePrice, placeholder: "0.00")
                            .keyboardType(.decimalPad)
                        ThemedTextField(label: "Platform Fees", text: $platformFees, placeholder: "0.00")
                            .keyboardType(.decimalPad)

                        if feesExceedPrice {
                            Text("Platform fees cannot exceed sale price")
                                .font(AppTheme.Typography.caption)
                                .foregroundStyle(AppTheme.Colors.loss)
                        }

                        if let error = vm.validationError {
                            Text(error)
                                .font(AppTheme.Typography.caption)
                                .foregroundStyle(AppTheme.Colors.loss)
                        }

                        Button("Record Sale") {
                            Task {
                                let success = await vm.recordSale(
                                    itemId: selectedItemId, platform: platform,
                                    salePrice: salePriceDecimal, platformFees: feesDecimal
                                )
                                if success {
                                    await inventoryVM.fetchItems()
                                    dismiss()
                                }
                            }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(!isFormValid)
                        .opacity(isFormValid ? 1.0 : 0.5)
                    }
                }
                .padding(AppTheme.Spacing.md)
            }
            .background(AppTheme.Colors.bg)
            .navigationTitle("Record Sale")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(AppTheme.Colors.textMuted)
                }
            }
        }
    }
}
