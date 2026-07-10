const Dashboard = {
    stats: {},

    async load() {
        try {
            const data = await API.request("getDashboardStats");
            this.stats = data || {};
            this.render();
        } catch (e) {
            console.error("Failed to load dashboard stats", e);
            UI.showToast("Failed to load dashboard", "error");
            this.renderEmpty();
        }
    },

    renderEmpty() {
        const container = document.getElementById('dashboardStats');
        if (!container) return;
        container.innerHTML = `
            <div style="grid-column: 1/-1; color: var(--text-muted); text-align: center; padding: 50px;">
                <i class="fas fa-chart-line" style="font-size: 3rem; margin-bottom: 20px;"></i>
                <p>Unable to load dashboard data. Please try again later.</p>
            </div>
        `;
    },

    render() {
        const container = document.getElementById('dashboardStats');
        if (!container) {
            console.warn("Dashboard stats container not found");
            return;
        }

        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Total Revenue</div>
                <div class="stat-value">Rs ${(this.stats.totalRevenue || 0).toLocaleString()}</div>
                <div class="stat-meta">This Month</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Customers</div>
                <div class="stat-value">${this.stats.totalCustomers || 0}</div>
                <div class="stat-meta">Active Clients</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Today's Appointments</div>
                <div class="stat-value">${this.stats.todayAppointments || 0}</div>
                <div class="stat-meta">Scheduled</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Low Stock Items</div>
                <div class="stat-value">${this.stats.lowStockItems || 0}</div>
                <div class="stat-meta">Alert</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">This Month Bookings</div>
                <div class="stat-value">${this.stats.monthlyBookings || 0}</div>
                <div class="stat-meta">Completed</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Average Bill Value</div>
                <div class="stat-value">Rs ${(this.stats.avgBillValue || 0).toLocaleString()}</div>
                <div class="stat-meta">Per Transaction</div>
            </div>
        `;
    }
};
