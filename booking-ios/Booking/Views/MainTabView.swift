import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @StateObject private var inventoryVM = InventoryViewModel()
    @StateObject private var salesVM = SalesViewModel()
    @StateObject private var analyticsVM = AnalyticsViewModel()
    @StateObject private var usersVM = UsersViewModel()

    var body: some View {
        TabView {
            NavigationStack {
                ItemListView(vm: inventoryVM)
                    .navigationTitle("Inventory")
            }
            .environmentObject(authVM)
            .tabItem {
                Label("Inventory", systemImage: "shippingbox")
            }

            NavigationStack {
                SalesListView(vm: salesVM, inventoryVM: inventoryVM)
                    .navigationTitle("Sales")
            }
            .environmentObject(authVM)
            .tabItem {
                Label("Sales", systemImage: "dollarsign.circle")
            }

            if authVM.role == "ADMIN" || authVM.role == "ACCOUNTANT" {
                NavigationStack {
                    AnalyticsView(vm: analyticsVM)
                        .navigationTitle("Analytics")
                }
                .tabItem {
                    Label("Analytics", systemImage: "chart.bar")
                }
            }

            if authVM.role == "ADMIN" {
                NavigationStack {
                    UsersView(vm: usersVM)
                        .navigationTitle("Team")
                }
                .tabItem {
                    Label("Team", systemImage: "person.3")
                }
            }
        }
        .tint(AppTheme.Colors.gold)
        .onReceive(NotificationCenter.default.publisher(for: .authExpired)) { _ in
            authVM.isAuthenticated = false
        }
    }
}
