import SwiftUI

struct UsersView: View {
    @ObservedObject var vm: UsersViewModel
    @State private var showAddSheet = false

    var body: some View {
        Group {
            if vm.isLoading && vm.users.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if vm.users.isEmpty {
                VStack(spacing: AppTheme.Spacing.md) {
                    Image(systemName: "person.3")
                        .font(.system(size: 48))
                        .foregroundStyle(AppTheme.Colors.textMuted)
                    Text("No team members yet")
                        .font(AppTheme.Typography.heading)
                        .foregroundStyle(AppTheme.Colors.text)
                    Text("Add your first colleague to get started.")
                        .font(AppTheme.Typography.bodySmall)
                        .foregroundStyle(AppTheme.Colors.textMuted)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(vm.users) { user in
                        HStack {
                            VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                                Text(user.displayName)
                                    .font(AppTheme.Typography.body)
                                    .foregroundStyle(AppTheme.Colors.text)
                                Text(user.email)
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textMuted)
                            }
                            Spacer()
                            RoleBadge(role: user.role)
                        }
                        .listRowBackground(AppTheme.Colors.surface)
                    }
                }
                .refreshable { await vm.fetchUsers() }
            }
        }
        .background(AppTheme.Colors.bg)
        .overlay(alignment: .top) {
            if let error = vm.errorMessage {
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
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showAddSheet = true
                } label: {
                    Image(systemName: "plus")
                        .foregroundStyle(AppTheme.Colors.gold)
                }
            }
        }
        .sheet(isPresented: $showAddSheet) {
            AddUserSheet(vm: vm)
        }
        .task { await vm.fetchUsers() }
    }
}

struct RoleBadge: View {
    let role: String

    private var badgeColor: Color {
        switch role {
        case "ADMIN": return AppTheme.Colors.gold
        case "BUYER": return AppTheme.Colors.info
        case "SELLER": return AppTheme.Colors.profit
        case "ACCOUNTANT": return AppTheme.Colors.textMuted
        default: return AppTheme.Colors.textMuted
        }
    }

    var body: some View {
        Text(role)
            .font(AppTheme.Typography.caption)
            .fontWeight(.medium)
            .padding(.horizontal, AppTheme.Spacing.sm)
            .padding(.vertical, AppTheme.Spacing.xs)
            .background(badgeColor.opacity(0.15))
            .foregroundStyle(badgeColor)
            .cornerRadius(AppTheme.Radius.sm)
    }
}

struct AddUserSheet: View {
    @ObservedObject var vm: UsersViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var displayName = ""
    @State private var role = "BUYER"

    private let roles = ["ADMIN", "BUYER", "SELLER", "ACCOUNTANT"]
    private var isFormValid: Bool { !email.isEmpty && !displayName.isEmpty }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppTheme.Spacing.md) {
                    ThemedTextField(label: "Email", text: $email, placeholder: "user@example.com")
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    ThemedTextField(label: "Display Name", text: $displayName, placeholder: "Jane Doe")

                    VStack(alignment: .leading, spacing: AppTheme.Spacing.xs) {
                        Text("Role")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textMuted)
                        Picker("Role", selection: $role) {
                            ForEach(roles, id: \.self) { Text($0) }
                        }
                        .pickerStyle(.segmented)
                    }

                    Button("Add Member") {
                        Task {
                            await vm.createUser(email: email, displayName: displayName, role: role)
                            dismiss()
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!isFormValid)
                    .opacity(isFormValid ? 1.0 : 0.5)
                }
                .padding(AppTheme.Spacing.md)
            }
            .background(AppTheme.Colors.bg)
            .navigationTitle("Add Member")
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
