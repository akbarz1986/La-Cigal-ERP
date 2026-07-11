const App = {
    init() {
        console.log("Initializing La Cigal ERP Modules...");
        
        // Load initial data
        POS.loadServices();
        Customers.load();
        Bookings.load();
        Inventory.load();
        Packages.load();
        
        // Setup initial UI states
        UI.switchView('pos');
        
        // Update clock or other global states if needed
    }
};

// Application entry point handled by Auth.loginSuccess()
