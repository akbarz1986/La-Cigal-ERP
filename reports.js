const Reports = {
    data: [],

    async load() {
        try {
            const data = await API.request("getReports");
            this.data = data || [];
            this.render();
        } catch (e) {
            console.error("Failed to load reports", e);
            UI.showToast("Failed to load reports", "error");
            this.renderEmpty();
        }
    },

    renderEmpty() {
        const container = document.getElementById('reportContent');
        if (!container) return;
        container.innerHTML = `
            <div style="color: var(--text-muted); text-align: center; padding: 50px;">
                <i class="fas fa-file-alt" style="font-size: 3rem; margin-bottom: 20px;"></i>
                <p>No reports available at this time.</p>
            </div>
        `;
    },

    render() {
        const container = document.getElementById('reportContent');
        if (!container) {
            console.warn("Report content container not found");
            return;
        }

        if (this.data.length === 0) {
            this.renderEmpty();
            return;
        }

        container.innerHTML = `
            <div class="reports-container">
                <div class="report-section">
                    <h3>Sales Report</h3>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Total Sales</th>
                                <th>Transactions</th>
                                <th>Avg Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.data.map(report => `
                                <tr>
                                    <td>${report.date || 'N/A'}</td>
                                    <td>Rs ${(report.totalSales || 0).toLocaleString()}</td>
                                    <td>${report.transactionCount || 0}</td>
                                    <td>Rs ${(report.avgValue || 0).toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
};