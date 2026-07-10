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

        const netProfit = this.stats.netProfit || 0;

        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Revenue This Month</div>
                <div class="stat-value">Rs ${(this.stats.totalRevenue || 0).toLocaleString()}</div>
                <div class="stat-meta">Total Sales</div>
            </div>
            <div class="stat-card expense">
                <div class="stat-label">Expenses This Month</div>
                <div class="stat-value" style="color:var(--danger)">Rs ${(this.stats.totalExpenses || 0).toLocaleString()}</div>
                <div class="stat-meta">Total Outgoings</div>
            </div>
            <div class="stat-card ${netProfit >= 0 ? 'profit' : 'expense'}">
                <div class="stat-label">Net Profit</div>
                <div class="stat-value" style="color:${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">Rs ${netProfit.toLocaleString()}</div>
                <div class="stat-meta">Revenue - Expenses</div>
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
            <div class="stat-card ${(this.stats.lowStockItems || 0) > 0 ? 'warning' : ''}">
                <div class="stat-label">Low Stock Items</div>
                <div class="stat-value" style="color:${(this.stats.lowStockItems || 0) > 0 ? '#f39c12' : 'var(--primary-gold)'}">
                    ${this.stats.lowStockItems || 0}
                </div>
                <div class="stat-meta">${(this.stats.lowStockItems || 0) > 0 ? '⚠️ Needs Attention' : 'All Good'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">This Month Bookings</div>
                <div class="stat-value">${this.stats.monthlyBookings || 0}</div>
                <div class="stat-meta">Appointments</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Average Bill Value</div>
                <div class="stat-value">Rs ${(this.stats.avgBillValue || 0).toLocaleString()}</div>
                <div class="stat-meta">Per Transaction</div>
            </div>
        `;
    }
};
