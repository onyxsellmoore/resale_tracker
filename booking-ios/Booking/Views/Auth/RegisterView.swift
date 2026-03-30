import SwiftUI

struct RegisterView: View {
    @ObservedObject var viewModel: AuthViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var orgName = ""
    @State private var adminDisplayName = ""
    @State private var adminEmail = ""

    private var isFormValid: Bool {
        !orgName.isEmpty && !adminDisplayName.isEmpty && !adminEmail.isEmpty
    }

    /// Matches web toSlug(): lowercase, strip special chars, collapse hyphens
    private static func toSlug(_ name: String) -> String {
        name.lowercased()
            .replacing(/[^a-z0-9\s-]/, with: "")
            .replacing(/\s+/, with: "-")
            .replacing(/-+/, with: "-")
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: AppTheme.Spacing.lg) {
                Text("Set Up Your Organization")
                    .font(AppTheme.Typography.displaySmall)
                    .foregroundStyle(AppTheme.Colors.text)
                    .padding(.top, AppTheme.Spacing.md)

                Text("Create your organization and admin account to get started.")
                    .font(AppTheme.Typography.bodySmall)
                    .foregroundStyle(AppTheme.Colors.textMuted)

                Group {
                    ThemedTextField(label: "Organization Name", text: $orgName, placeholder: "My Company")

                    ThemedTextField(label: "Your Name", text: $adminDisplayName, placeholder: "Jane Doe")

                    ThemedTextField(label: "Email", text: $adminEmail, placeholder: "admin@example.com")
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(AppTheme.Typography.caption)
                        .foregroundStyle(.white)
                        .padding(AppTheme.Spacing.sm)
                        .frame(maxWidth: .infinity)
                        .background(AppTheme.Colors.loss)
                        .cornerRadius(AppTheme.Radius.md)
                }

                Button {
                    Task {
                        let slug = Self.toSlug(orgName)
                        await viewModel.registerOrg(
                            orgName: orgName, orgSlug: slug,
                            adminEmail: adminEmail, adminDisplayName: adminDisplayName
                        )
                    }
                } label: {
                    if viewModel.isLoading {
                        ProgressView()
                            .tint(AppTheme.Colors.bg)
                    } else {
                        Text("Create Organization")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(!isFormValid || viewModel.isLoading)
                .opacity(isFormValid ? 1.0 : 0.5)
            }
            .padding(.horizontal, AppTheme.Spacing.md)
        }
        .background(AppTheme.Colors.bg.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
    }
}
