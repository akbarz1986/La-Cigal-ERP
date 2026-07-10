const Refunds = {
    data: [],
    bills: [],

    async load() {
        try {
            this.data = await API.request("getRefunds");
            this.render();
        } catch (e) {
            console.error("Failed to load refunds", e);
            UI.showToast("Failed to load refunds", "error");
            this.data = [];
            this.render();
        }
    },

    render() {
        const container = document.getElementById('refundList');
        if (!container) return;

        const totalRefunded = this.data.reduce((sum, r) => sum + parseFloat(r.RefundAmount || 0), 0);

        const summary = document.getElementById('refundSummary');
        if (summary) {
            summary.innerHTML = `<div class="stat-card" style="margin-bottom:20px;">
                <div class="stat-label">Total Refunded</div>
                <div class="stat-value" style="color:var(--danger)">Rs ${totalRefunded.toLocaleString()}</div>
                <div class="stat-meta">${this.data.length} refund(s) processed</div>
            </div>`;
        }

        if (this.data.length === 0) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-undo"></i><p>No refunds processed yet.</p></div>`;
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Date</th><th>Original Bill</th><th>Amount</th><th>Method</th><th>Reason</th><th>Approved By</th></tr></thead>
                <tbody>
                    ${this.data.map(r => `
                        <tr>
                            <td>${r.ApprovalDate ? new Date(r.ApprovalDate).toLocaleDateString() : 'N/A'}</td>
                            <td>${r.OriginalBillID || '-'}</td>
                            <td><strong style="color:var(--danger)">Rs ${parseFloat(r.RefundAmount || 0).toLocaleString()}</strong></td>
                            <td>${r.RefundMethod || 'Cash'}</td>
                            <td>${r.Reason || '-'}</td>
                            <td style="color:var(--text-muted)">${r.ApprovedBy || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
    },

    openRefundModal() {
        document.getElementById('refundBillID').value = '';
        document.getElementById('refundAmount').value = '';
        document.getElementById('refundReason').value = '';
        UI.openModal('refundModal');
    },

    async process() {
        const originalBillID = document.getElementById('refundBillID')?.value;
        const refundAmount = parseFloat(document.getElementById('refundAmount')?.value);
        const refundMethod = document.getElementById('refundMethod')?.value;
        const reason = document.getElementById('refundReason')?.value;
        const notes = document.getElementById('refundNotes')?.value;

        if (!originalBillID || isNaN(refundAmount) || refundAmount <= 0) {
            UI.showToast("Please fill all required fields", "error");
            return;
        }

        if (!reason) {
            UI.showToast("Please provide a reason for the refund", "error");
            return;
        }

        try {
            await API.request("processRefund", { originalBillID, refundAmount, refundMethod, reason, notes });
            UI.showToast("Refund processed successfully!");
            UI.closeModal('refundModal');
            this.load();
        } catch (e) {
            UI.showToast("Failed to process refund: " + e.message, "error");
        }
    }
};
