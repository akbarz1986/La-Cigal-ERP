const Credits = {
    data: [],
    customers: [],

    async load() {
        try {
            [this.data, this.customers] = await Promise.all([
                API.request("getCredits"),
                API.request("getCustomers").catch(() => [])
            ]);
            this.render();
        } catch (e) {
            console.error("Failed to load credits", e);
            UI.showToast("Failed to load credits", "error");
            this.data = [];
            this.render();
        }
    },

    getCustomerName(customerID) {
        const c = this.customers.find(c => c.CustomerID === customerID);
        return c ? c.Name : customerID;
    },

    render() {
        const container = document.getElementById('creditList');
        if (!container) return;

        const outstanding = this.data.filter(c => c.Status !== 'Paid');
        const totalOutstanding = outstanding.reduce((sum, c) => {
            const rem = parseFloat(c.RemainingAmo !== undefined ? c.RemainingAmo : (c.RemainingAmount !== undefined ? c.RemainingAmount : c.Amount)) || 0;
            return sum + rem;
        }, 0);

        const summary = document.getElementById('creditSummary');
        if (summary) {
            summary.innerHTML = `<div class="stat-card" style="margin-bottom:20px;">
                <div class="stat-label">Total Outstanding Credits</div>
                <div class="stat-value" style="color:var(--danger)">Rs ${totalOutstanding.toLocaleString()}</div>
                <div class="stat-meta">${outstanding.length} active credit(s)</div>
            </div>`;
        }

        if (this.data.length === 0) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-credit-card"></i><p>No credit records found.</p></div>`;
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Customer</th><th>Invoice</th><th>Total Due</th><th>Paid</th><th>Remaining</th><th>Pay Date</th><th>MOP</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                    ${this.data.map(c => {
                        const totalDue = parseFloat(c.OutstandingBal !== undefined ? c.OutstandingBal : (c.OutstandingBalance !== undefined ? c.OutstandingBalance : c.Amount)) || 0;
                        const paid = parseFloat(c.PaidAmount !== undefined ? c.PaidAmount : 0);
                        const remaining = parseFloat(c.RemainingAmo !== undefined ? c.RemainingAmo : (c.RemainingAmount !== undefined ? c.RemainingAmount : c.Amount)) || 0;
                        const status = c.Status || 'Unpaid';
                        const invoice = c.InvoiceNumber || '-';
                        const payDate = c.PaymentDate || '-';
                        const mop = c.MOP || '-';
                        
                        return `
                        <tr>
                            <td><strong>${this.getCustomerName(c.CustomerID)}</strong></td>
                            <td>${invoice}</td>
                            <td>Rs ${totalDue.toLocaleString()}</td>
                            <td style="color:var(--success)">Rs ${paid.toLocaleString()}</td>
                            <td><strong style="color:${remaining > 0 ? 'var(--danger)' : 'var(--success)'}">Rs ${remaining.toLocaleString()}</strong></td>
                            <td>${payDate}</td>
                            <td><span class="badge" style="background:var(--primary-pink-dark);color:var(--text-primary);border:1px solid var(--border-color);">${mop}</span></td>
                            <td><span class="badge ${status === 'Paid' ? 'badge-success' : 'badge-danger'}">${status}</span></td>
                            <td>${status !== 'Paid' ? `<button class="btn btn-primary" style="padding:6px 12px;font-size:0.85rem;" onclick="Credits.openPaymentModal('${c.CreditID}','${remaining}')">Record Payment</button>` : '-'}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>`;
    },

    openPaymentModal(creditID, remaining) {
        document.getElementById('creditPaymentID').value = creditID;
        document.getElementById('creditPaymentAmount').value = remaining;
        document.getElementById('creditPaymentAmount').max = remaining;
        
        // Set payment date default to today in Islamabad timezone
        const today = getIslamabadDate();
        const dateInput = document.getElementById('creditPaymentDate');
        if (dateInput) {
            dateInput.value = today;
        }
        
        UI.openModal('creditPaymentModal');
    },

    async recordPayment() {
        const creditID = document.getElementById('creditPaymentID')?.value;
        const amount = parseFloat(document.getElementById('creditPaymentAmount')?.value);
        const method = document.getElementById('creditPaymentMethod')?.value;
        const date = document.getElementById('creditPaymentDate')?.value;
        const notes = document.getElementById('creditPaymentNotes')?.value;

        if (!creditID || isNaN(amount) || amount <= 0) {
            UI.showToast("Please enter a valid amount", "error");
            return;
        }

        try {
            await API.request("recordCreditPayment", { creditID, amount, method, date, notes });
            UI.showToast("Payment recorded successfully!");
            UI.closeModal('creditPaymentModal');
            this.load();
        } catch (e) {
            UI.showToast("Failed to record payment: " + e.message, "error");
        }
    }
};
