import SwiftUI

// ⚠️ MAINTENANCE: AppTheme.swift must be updated manually when theme.css changes.
// After any design update to theme.css, diff it against this file and mirror the changes.
enum AppTheme {

    enum Colors {
        // Backgrounds
        static let bg = Color("Bg")
        static let surface = Color("Surface")
        static let surface2 = Color("Surface2")

        // Borders
        static let border = Color("Border")
        static let borderSubtle = Color("BorderSubtle")

        // Brand greens
        static let brand = Color("Brand")
        static let brandHover = Color("BrandHover")

        // Gold accent
        static let gold = Color("Gold")
        static let goldHover = Color("GoldHover")
        static let goldDim = Color("GoldDim")
        static let goldGlow = Color("GoldGlow")

        // Text
        static let text = Color("TextPrimary")
        static let textMuted = Color("TextMuted")

        // Semantic
        static let profit = Color("Profit")
        static let loss = Color("Loss")
        static let info = Color("Info")
    }

    enum Radius {
        static let sm: CGFloat = 4
        static let md: CGFloat = 8
        static let lg: CGFloat = 12
    }

    enum Typography {
        static let display = Font.system(size: 28, weight: .bold, design: .serif)
        static let displaySmall = Font.system(size: 22, weight: .bold, design: .serif)
        static let heading = Font.system(size: 18, weight: .semibold, design: .default)
        static let body = Font.system(size: 16, weight: .regular, design: .default)
        static let bodySmall = Font.system(size: 14, weight: .regular, design: .default)
        static let caption = Font.system(size: 12, weight: .regular, design: .default)
        static let button = Font.system(size: 14, weight: .medium, design: .default)
    }

    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
    }
}

// MARK: - Styled Button Modifiers

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AppTheme.Typography.button)
            .fontWeight(.semibold)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(AppTheme.Colors.gold)
            .foregroundStyle(AppTheme.Colors.bg)
            .cornerRadius(AppTheme.Radius.md)
            .opacity(configuration.isPressed ? 0.85 : 1.0)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AppTheme.Typography.button)
            .fontWeight(.medium)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(AppTheme.Colors.surface2)
            .foregroundStyle(AppTheme.Colors.brandHover)
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.Radius.md)
                    .stroke(AppTheme.Colors.brand, lineWidth: 1)
            )
            .cornerRadius(AppTheme.Radius.md)
            .opacity(configuration.isPressed ? 0.85 : 1.0)
    }
}

struct DangerButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AppTheme.Typography.button)
            .fontWeight(.medium)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(configuration.isPressed ? AppTheme.Colors.loss : Color.clear)
            .foregroundStyle(configuration.isPressed ? AppTheme.Colors.text : AppTheme.Colors.loss)
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.Radius.sm)
                    .stroke(AppTheme.Colors.loss, lineWidth: 1)
            )
            .cornerRadius(AppTheme.Radius.sm)
    }
}
