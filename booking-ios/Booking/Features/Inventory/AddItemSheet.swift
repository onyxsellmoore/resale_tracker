import SwiftUI

struct AddItemSheet: View {
    @ObservedObject var vm: InventoryViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var brand = ""
    @State private var category = ""
    @State private var condition = "GOOD"
    @State private var purchasePrice = ""
    @State private var purchaseDate = Date()
    @State private var description = ""
    @State private var notes = ""

    private let conditions = ["EXCELLENT", "GOOD", "FAIR", "POOR"]

    private var priceDecimal: Decimal {
        Decimal(string: purchasePrice) ?? .zero
    }

    private var isFormValid: Bool {
        !name.isEmpty && priceDecimal > 0
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppTheme.Spacing.md) {
                    ThemedTextField(label: "Name *", text: $name, placeholder: "Item name")

                    if vm.validationError != nil && name.isEmpty {
                        Text(vm.validationError!)
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.loss)
                    }

                    ThemedTextField(label: "Brand", text: $brand, placeholder: "Brand name")
                    ThemedTextField(label: "Category", text: $category, placeholder: "Category")

                    VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                        Text("Condition")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textMuted)
                        Picker("Condition", selection: $condition) {
                            ForEach(conditions, id: \.self) { Text($0) }
                        }
                        .pickerStyle(.segmented)
                    }

                    ThemedTextField(label: "Purchase Price *", text: $purchasePrice, placeholder: "0.00")
                        .keyboardType(.decimalPad)

                    VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                        Text("Purchase Date")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textMuted)
                        DatePicker("", selection: $purchaseDate, displayedComponents: .date)
                            .labelsHidden()
                    }

                    ThemedTextField(label: "Description", text: $description, placeholder: "Optional description")
                    ThemedTextField(label: "Notes", text: $notes, placeholder: "Optional notes")

                    if let error = vm.validationError, !name.isEmpty {
                        Text(error)
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.loss)
                    }

                    Button("Add Item") {
                        Task {
                            let formatter = ISO8601DateFormatter()
                            formatter.formatOptions = [.withFullDate]
                            let dateStr = formatter.string(from: purchaseDate)
                            await vm.addItem(
                                name: name, brand: brand, category: category,
                                condition: condition, purchasePrice: priceDecimal,
                                purchaseDate: dateStr,
                                description: description.isEmpty ? nil : description,
                                notes: notes.isEmpty ? nil : notes
                            )
                            if vm.validationError == nil {
                                dismiss()
                            }
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!isFormValid)
                    .opacity(isFormValid ? 1.0 : 0.5)
                }
                .padding(AppTheme.Spacing.md)
            }
            .background(AppTheme.Colors.bg)
            .navigationTitle("Add Item")
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

struct ThemedTextField: View {
    let label: String
    @Binding var text: String
    var placeholder: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
            Text(label)
                .font(AppTheme.Typography.caption)
                .foregroundStyle(AppTheme.Colors.textMuted)
            TextField(placeholder, text: $text)
                .font(AppTheme.Typography.body)
                .padding(AppTheme.Spacing.sm)
                .background(AppTheme.Colors.surface2)
                .foregroundStyle(AppTheme.Colors.text)
                .cornerRadius(AppTheme.Radius.md)
                .overlay(
                    RoundedRectangle(cornerRadius: AppTheme.Radius.md)
                        .stroke(AppTheme.Colors.border, lineWidth: 1)
                )
        }
    }
}
