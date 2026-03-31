import SwiftUI

struct LoginView: View {
    @ObservedObject var viewModel: AuthViewModel
    @State private var email = ""
    @State private var showRegister = false

    var body: some View {
        NavigationStack {
            VStack(spacing: AppTheme.Spacing.lg) {
                Spacer()

                // PARITY FIX: branding uses serif display font matching web Playfair Display
                VStack(spacing: AppTheme.Spacing.sm) {
                    Text("Booking")
                        .font(AppTheme.Typography.display)
                        .foregroundStyle(AppTheme.Colors.gold)
                    Text("Sign in to manage your inventory")
                        .font(AppTheme.Typography.bodySmall)
                        .foregroundStyle(AppTheme.Colors.textMuted)
                }

                // Email field
                TextField("Email address", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .font(AppTheme.Typography.body)
                    .padding(AppTheme.Spacing.md)
                    .background(AppTheme.Colors.surface2)
                    .foregroundStyle(AppTheme.Colors.text)
                    .cornerRadius(AppTheme.Radius.md)
                    .overlay(
                        RoundedRectangle(cornerRadius: AppTheme.Radius.md)
                            .stroke(AppTheme.Colors.border, lineWidth: 1)
                    )
                    .padding(.horizontal, AppTheme.Spacing.md)

                // Error banner
                if let error = viewModel.errorMessage {
                    // PARITY FIX: error banner matches web red bg + white text
                    Text(error)
                        .font(AppTheme.Typography.caption)
                        .foregroundStyle(.white)
                        .padding(AppTheme.Spacing.sm)
                        .frame(maxWidth: .infinity)
                        .background(AppTheme.Colors.loss)
                        .cornerRadius(AppTheme.Radius.md)
                        .padding(.horizontal, AppTheme.Spacing.md)
                }

                // PARITY FIX: primary button uses gold bg matching web btn-primary
                Button {
                    Task { await viewModel.login(email: email) }
                } label: {
                    if viewModel.isLoading {
                        ProgressView()
                            .tint(AppTheme.Colors.bg)
                    } else {
                        Text("Sign in with Passkey")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .padding(.horizontal, AppTheme.Spacing.md)
                .disabled(email.isEmpty || viewModel.isLoading)
                .opacity(email.isEmpty ? 0.5 : 1.0)

                // Register link
                Button("Create a new organization") {
                    viewModel.clearError()
                    showRegister = true
                }
                .font(AppTheme.Typography.caption)
                .foregroundStyle(AppTheme.Colors.gold)

                Spacer()
            }
            .background(AppTheme.Colors.bg.ignoresSafeArea())
            .navigationDestination(isPresented: $showRegister) {
                RegisterView(viewModel: viewModel)
            }
        }
    }
}
