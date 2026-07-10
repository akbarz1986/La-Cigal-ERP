const Expenses = {
    data: [],
    CATEGORIES: ["Rent", "Utilities", "Salaries", "Supplies", "Marketing", "Maintenance", "Food & Beverages", "Other"],

    async load() {
        try {
            this.data = await API.request("getExpenses");
            this.render();
        } catch (e) {
            console.error("Failed to load expenses", e);
            UI.showToast("Failed to load expenses", "error");
            this.data = [];
            this.render();
        }
    },

    render() {
        const container = document.getElementById('expenseList');
        if (!container) return;

        const totalThisMonth = this.data
            .filter(e => {
                const d = new Date(e.Date);
                const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            })
            .reduce((sum, e) => sum + parseFloat(e.Amount || 0), 0);

        const summary = document.getElementById('expenseSummary');
        if (summary) {
            summary.innerHTML = `<div class="stat-card" style="margin-bottom:20px;">
                <div class="stat-label">This Month's Expenses</div>
                <div class="stat-value" style="color:var(--danger)">Rs ${totalThisMonth.toLocaleString()}</div>
            </div>`;
        }

        if (this.data.length === 0) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-receipt"></i><p>No expenses recorded yet.</p></div>`;
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Date</th><th>Category</th><th>Notes</th><th>Payment</th><th>Amount</th><th>By</th></tr></thead>
                <tbody>
                    ${this.data.map(e => `
                        <tr>
                            <td>${e.Date ? new Date(e.Date).toLocaleDateString() : 'N/A'}</td>
                            <td><span class="badge badge-info">${e.Category || 'General'}</span></td>
                            <td>${e.Notes || '-'}</td>
                            <td>${e.PaymentMethod || 'Cash'}</td>
                            <td><strong style="color:var(--danger)">Rs ${parseFloat(e.Amount || 0).toLocaleString()}</strong></td>
                            <td style="color:var(--text-muted)">${e.CreatedBy || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
    },

    async save() {
        const date = document.getElementById('expDate')?.value;
        const category = document.getElementById('expCategory')?.value;
        const amount = parseFloat(document.getElementById('expAmount')?.value);
        const paymentMethod = document.getElementById('expPayment')?.value;
        const notes = document.getElementById('expNotes')?.value;

        if (!date || !category || isNaN(amount) || amount <= 0) {
            UI.showToast("Please fill all required fields", "error");
            return;
        }

        try {
            await API.request("addExpense", { date, category, amount, paymentMethod, notes });
            UI.showToast("Expense recorded successfully!");
            UI.closeModal('expenseModal');
            document.getElementById('expenseForm').reset();
            this.load();
        } catch (e) {
            UI.showToast("Failed to save expense: " + e.message, "error");
        }
    }
};
