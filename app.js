const App = {
    init() {
        console.log("Initializing La Cigal ERP Modules...");
        
        // Set default dates to Islamabad (Asia/Karachi) timezone
        const todayStr = getIslamabadDate();
        ['bookingDate', 'expDate', 'bookingDateFilter', 'creditPaymentDate'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = todayStr;
        });

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
