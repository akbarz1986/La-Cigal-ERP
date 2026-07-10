const POS = {
    services: [],
    currentTicket: [],
    selectedCustomer: null,
    appliedVoucher: null,
    discountPercent: 0,
    discountType: 'percentage', // 'percentage' or 'fixed'
    discountAmount: 0,
    taxPercent: 0,
    savedBills: [], // Store saved bill drafts

    async loadServices() {
        try {
            const [services, inventory] = await Promise.all([
                API.request("getServices").catch(() => []),
                API.request("getInventory").catch(() => [])
            ]);

            const formattedServices = (services || []).map(s => ({ ...s, Type: "Service" }));
            const formattedInventory = (inventory || [])
                .filter(i => i.Status === "Active")
                .map(i => ({
                    ServiceID: i.ProductID,
                    ProductID: i.ProductID,
                    Name: i.Name,
                    Price: i.SellingPrice || i.Price || 0,
                    Status: "Active",
                    Type: "Retail",
                    Stock: i.CurrentStock || i.Stock || 0,
                    Category: i.Category || "Retail"
                }));

            this.services = [...formattedServices, ...formattedInventory];
            this.renderCategories();
            this.renderServices();
            this.loadSavedBills();
        } catch (e) {
            console.error("Failed to load POS items", e);
            UI.showToast("Failed to load POS items", "error");
        }
    },

    renderCategories() {
        const container = document.getElementById('posCategories');
        if (!container) return;

        const categories = ['All', ...new Set(this.services.map(s => s.Category || s.Type || 'Service'))];

        container.innerHTML = categories.map((cat, i) => `
            <div class="cat-card ${i === 0 ? 'active' : ''}" onclick="POS.filterByCategory('${cat}', this)">
                ${cat}
            </div>
        `).join('');
    },

    filterByCategory(category, el) {
        document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('active'));
        if (el) el.classList.add('active');

        const container = document.getElementById('serviceItems');
        if (!container) return;

        const filtered = category === 'All'
            ? this.services
            : this.services.filter(s => (s.Category || s.Type) === category);

        this._renderServiceButtons(container, filtered);
    },

    renderServices() {
        const container = document.getElementById('serviceItems');
        if (!container) return;
        this._renderServiceButtons(container, this.services);
    },

    _renderServiceButtons(container, services) {
        container.innerHTML = "";

        const active = services.filter(s => s.Status === "Active");
        if (active.length === 0) {
            container.innerHTML = `<div style='grid-column:1/-1;color:var(--text-muted);text-align:center;'>No items found.</div>`;
            return;
        }

        active.forEach(srv => {
            const btn = document.createElement('button');
            btn.className = 'service-btn';
            btn.type = 'button';
            btn.innerHTML = `
                <h4>${srv.Name}</h4>
                <p>Rs ${parseFloat(srv.Price) || 0}</p>
                ${srv.Type === 'Retail' ? `<small style="color:var(--text-muted)"><i class="fas fa-box"></i> Stock: ${srv.Stock || 0}</small>` : ''}
            `;
            btn.onclick = () => this.addToTicket(srv);
            container.appendChild(btn);
        });
    },

    setCustomer(customer) {
        this.selectedCustomer = customer;
        const ticketCustomer = document.getElementById('ticketCustomer');
        if (ticketCustomer) {
            ticketCustomer.innerHTML = `
                <p><strong>${customer.Name}</strong> <br>
                <small>${customer.Phone}</small></p>
                <p style="font-size:0.85rem;color:var(--primary-gold);"><i class="fas fa-star"></i> ${customer.LoyaltyPoints || 0} pts</p>`;
        }
        UI.showToast(`Selected: ${customer.Name} (${customer.LoyaltyPoints || 0} pts)`);
    },

    addToTicket(service) {
        this.currentTicket.push({
            ...service,
            uid: Date.now() + Math.random(),
            FinalPrice: parseFloat(service.Price) || 0
        });
        this.renderTicket();
    },

    removeFromTicket(uid) {
        this.currentTicket = this.currentTicket.filter(item => item.uid !== uid);
        this.renderTicket();
    },

    renderTicket() {
        const ticketDiv = document.getElementById('ticketItems');
        if (!ticketDiv) return;

        if (this.currentTicket.length === 0) {
            ticketDiv.innerHTML = '<div class="empty-ticket">Select a service to start</div>';
            this.updateTotals(0);
            return;
        }

        ticketDiv.innerHTML = "";
        let subtotal = 0;

        this.currentTicket.forEach(item => {
            const price = parseFloat(item.FinalPrice || item.Price) || 0;
            subtotal += price;

            const row = document.createElement('div');
            row.className = 'ticket-row';
            row.innerHTML = `
                <div>
                    <strong>${item.Name}</strong>
                    ${item.Type === 'Retail' ? '<span class="badge badge-info" style="font-size:0.7rem;margin-left:5px;">Retail</span>' : ''}<br>
                    <small style="color:var(--text-muted)">Staff: ${item.Staff || 'Any'}</small>
                </div>
                <div style="display:flex;gap:15px;align-items:center;">
                    <span>Rs ${price.toFixed(2)}</span>
                    <button class="remove-item" type="button" onclick="POS.removeFromTicket(${item.uid})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            ticketDiv.appendChild(row);
        });

        this.updateTotals(subtotal);
    },

    updateTotals(subtotal) {
        // Apply discount
        let discountAmount = 0;
        if (this.discountType === 'percentage') {
            discountAmount = subtotal * (this.discountPercent / 100);
        } else {
            discountAmount = Math.min(this.discountAmount, subtotal);
        }
        let afterDiscount = subtotal - discountAmount;

        // Apply voucher
        let voucherDiscount = 0;
        if (this.appliedVoucher) {
            if (this.appliedVoucher.type === 'Percentage') {
                voucherDiscount = afterDiscount * (this.appliedVoucher.value / 100);
            } else {
                voucherDiscount = Math.min(this.appliedVoucher.value, afterDiscount);
            }
            afterDiscount -= voucherDiscount;
        }

        // Apply tax
        const taxAmount = afterDiscount * (this.taxPercent / 100);
        const total = afterDiscount + taxAmount;

        const subtotalEl = document.getElementById('posSubtotal');
        const discountEl = document.getElementById('posDiscount');
        const taxEl = document.getElementById('posTax');
        const totalEl = document.getElementById('posTotal');
        const amountEl = document.getElementById('amountReceived');

        if (subtotalEl) subtotalEl.textContent = `Rs ${subtotal.toFixed(2)}`;
        if (discountEl) discountEl.textContent = `- Rs ${(discountAmount + voucherDiscount).toFixed(2)}`;
        if (taxEl) taxEl.textContent = `Rs ${taxAmount.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `Rs ${total.toFixed(2)}`;
        if (amountEl) amountEl.value = total.toFixed(2);
    },

    // NEW: Open discount modal from main page
    openDiscountModal() {
        if (this.currentTicket.length === 0) {
            UI.showToast("Ticket is empty!", "error");
            return;
        }
        document.getElementById('discountValue').value = this.discountType === 'percentage' ? this.discountPercent : this.discountAmount;
        UI.openModal('discountModal');
    },

    // NEW: Switch discount type
    switchDiscountType(type, btn) {
        document.querySelectorAll('.discount-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.discountType = type;
        const label = document.getElementById('discountLabel');
        if (label) {
            label.textContent = type === 'percentage' ? 'Discount Percentage (%)' : 'Discount Amount (Rs)';
        }
    },

    // NEW: Apply discount from modal
    applyDiscountFromModal() {
        const value = parseFloat(document.getElementById('discountValue').value) || 0;
        if (this.discountType === 'percentage') {
            if (value < 0 || value > 100) {
                UI.showToast("Discount percentage must be between 0 and 100", "error");
                return;
            }
            this.discountPercent = value;
        } else {
            if (value < 0) {
                UI.showToast("Discount amount cannot be negative", "error");
                return;
            }
            this.discountAmount = value;
        }
        const totalText = document.getElementById('posSubtotal')?.textContent || 'Rs 0';
        const subtotal = parseFloat(totalText.replace('Rs ', '')) || 0;
        this.updateTotals(subtotal);
        UI.showToast(`Discount applied: ${this.discountType === 'percentage' ? value + '%' : 'Rs ' + value}`);
        UI.closeModal('discountModal');
    },

    openCheckout() {
        if (this.currentTicket.length === 0) {
            UI.showToast("Ticket is empty!", "error");
            return;
        }
        // Reset voucher display
        const voucherInput = document.getElementById('voucherCode');
        const voucherStatus = document.getElementById('voucherStatus');
        if (voucherInput) voucherInput.value = '';
        if (voucherStatus) voucherStatus.textContent = '';
        this.appliedVoucher = null;
        UI.openModal('checkoutModal');
    },

    async applyVoucher() {
        const code = document.getElementById('voucherCode')?.value.trim().toUpperCase();
        const statusEl = document.getElementById('voucherStatus');

        if (!code) {
            UI.showToast("Please enter a voucher code", "error");
            return;
        }

        try {
            const voucher = await API.request("validateVoucher", { code });
            this.appliedVoucher = voucher;
            this.appliedVoucher.code = code;

            const desc = voucher.type === 'Percentage'
                ? `${voucher.value}% off`
                : `Rs ${voucher.value} off`;

            if (statusEl) statusEl.innerHTML = `<span style="color:var(--success)"><i class="fas fa-check-circle"></i> Voucher applied: ${desc}</span>`;
            UI.showToast(`Voucher applied: ${desc}`);

            // Recalculate totals
            const totalText = document.getElementById('posSubtotal')?.textContent || 'Rs 0';
            const subtotal = parseFloat(totalText.replace('Rs ', '')) || 0;
            this.updateTotals(subtotal);
        } catch (e) {
            this.appliedVoucher = null;
            if (statusEl) statusEl.innerHTML = `<span style="color:var(--danger)"><i class="fas fa-times-circle"></i> ${e.message}</span>`;
        }
    },

    applyDiscount() {
        const discEl = document.getElementById('checkoutDiscount');
        this.discountPercent = parseFloat(discEl?.value || 0);
        this.discountType = 'percentage';

        const totalText = document.getElementById('posSubtotal')?.textContent || 'Rs 0';
        const subtotal = parseFloat(totalText.replace('Rs ', '')) || 0;
        this.updateTotals(subtotal);
    },

    // NEW: Save bill as draft
    saveBillDraft() {
        if (this.currentTicket.length === 0) {
            UI.showToast("Ticket is empty!", "error");
            return;
        }
        const draft = {
            id: Date.now(),
            timestamp: new Date().toLocaleString(),
            items: JSON.parse(JSON.stringify(this.currentTicket)),
            customer: this.selectedCustomer,
            discount: this.discountPercent,
            discountType: this.discountType,
            discountAmount: this.discountAmount
        };
        this.savedBills.push(draft);
        localStorage.setItem('posBackups', JSON.stringify(this.savedBills));
        UI.showToast(`Bill saved as draft - ${draft.timestamp}`);
    },

    // NEW: Load saved drafts
    loadSavedBills() {
        const saved = localStorage.getItem('posBackups');
        this.savedBills = saved ? JSON.parse(saved) : [];
        this.renderSavedBillsList();
    },

    // NEW: Render saved bills list
    renderSavedBillsList() {
        const container = document.getElementById('savedBillsList');
        const noMsg = document.getElementById('noBillsMessage');
        if (!container) return;

        if (this.savedBills.length === 0) {
            container.innerHTML = '';
            if (noMsg) noMsg.style.display = 'block';
            return;
        }

        if (noMsg) noMsg.style.display = 'none';
        container.innerHTML = this.savedBills.map(bill => `
            <div style="border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px; background: var(--bg-secondary);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div>
                        <p style="margin: 0; font-weight: bold; color: var(--text-primary);">${bill.customer ? bill.customer.Name : 'Walk-in'}</p>
                        <small style="color: var(--text-muted);"><i class="fas fa-clock"></i> ${bill.timestamp}</small>
                    </div>
                    <span style="font-weight: bold; color: var(--primary-gold); font-size: 1.1rem;">${bill.items.length} items</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button class="btn btn-outline" style="font-size: 0.85rem; padding: 8px;" onclick="POS.loadBill(${bill.id})"><i class="fas fa-download"></i> Load</button>
                    <button class="btn btn-outline" style="font-size: 0.85rem; padding: 8px; color: var(--danger);" onclick="POS.deleteBill(${bill.id})"><i class="fas fa-trash"></i> Delete</button>
                </div>
            </div>
        `).join('');
    },

    // NEW: Load a specific bill
    loadBill(billId) {
        const bill = this.savedBills.find(b => b.id === billId);
        if (!bill) {
            UI.showToast("Bill not found!", "error");
            return;
        }
        this.currentTicket = JSON.parse(JSON.stringify(bill.items));
        this.selectedCustomer = bill.customer;
        this.discountPercent = bill.discount;
        this.discountType = bill.discountType || 'percentage';
        this.discountAmount = bill.discountAmount || 0;
        this.renderTicket();
        UI.closeModal('loadBillModal');
        UI.showToast(`Bill loaded: ${bill.timestamp}`);
    },

    // NEW: Delete a saved bill
    deleteBill(billId) {
        if (!confirm('Delete this draft permanently?')) return;
        this.savedBills = this.savedBills.filter(b => b.id !== billId);
        localStorage.setItem('posBackups', JSON.stringify(this.savedBills));
        this.renderSavedBillsList();
        UI.showToast("Draft deleted");
    },

    // NEW: Clear current bill
    clearBill() {
        if (this.currentTicket.length === 0) {
            UI.showToast("Ticket is already empty!", "info");
            return;
        }
        if (!confirm('Clear current bill? This cannot be undone.')) return;
        this.clear();
        UI.showToast("Bill cleared");
    },

    async finalizePayment() {
        const totalText = document.getElementById('posTotal')?.textContent || 'Rs 0';
        const total = parseFloat(totalText.replace('Rs ', ''));
        const amountReceived = parseFloat(document.getElementById('amountReceived')?.value || 0);
        const selectedPM = document.querySelector('.pm-card.active');
        const paymentMethod = selectedPM ? selectedPM.getAttribute('data-method') : 'Cash';

        // Credit doesn't require amount received upfront
        if (paymentMethod !== 'Credit') {
            if (isNaN(amountReceived) || amountReceived < total) {
                UI.showToast("Amount received is less than total!", "error");
                return;
            }
        }

        if (paymentMethod === 'Credit' && (!this.selectedCustomer || this.selectedCustomer.CustomerID === 'Walk-in')) {
            UI.showToast("Please select a customer to use Credit payment!", "error");
            return;
        }

        const subtotalText = document.getElementById('posSubtotal')?.textContent || 'Rs 0';
        const subtotal = parseFloat(subtotalText.replace('Rs ', ''));

        const payload = {
            customerID: this.selectedCustomer ? this.selectedCustomer.CustomerID : "Walk-in",
            subtotal: subtotal,
            billDiscount: this.discountType === 'percentage' ? subtotal * (this.discountPercent / 100) : this.discountAmount,
            voucherDiscounts: this.appliedVoucher ? (
                this.appliedVoucher.type === 'Percentage'
                    ? (subtotal - (this.discountType === 'percentage' ? subtotal * this.discountPercent / 100 : this.discountAmount)) * (this.appliedVoucher.value / 100)
                    : this.appliedVoucher.value
            ) : 0,
            tax: 0,
            total: total,
            paymentMethod: paymentMethod,
            items: this.currentTicket,
            amountReceived: amountReceived,
            change: paymentMethod !== 'Credit' ? amountReceived - total : 0,
            voucherCode: this.appliedVoucher ? this.appliedVoucher.code : null,
            remainingBalance: paymentMethod === 'Credit' ? total : 0
        };

        try {
            const result = await API.request("processPayment", payload);
            const change = payload.change;
            let successMsg = `Payment Successful! Invoice: ${result.invoiceNumber || 'N/A'}`;
            if (paymentMethod !== 'Credit' && change > 0) {
                successMsg += ` | Change: Rs ${change.toFixed(2)}`;
            }
            UI.showToast(successMsg);

            this.clear();
            UI.closeModal('checkoutModal');

        } catch (err) {
            UI.showToast("Payment failed: " + err.message, "error");
            console.error("Payment error:", err);
        }
    },

    clear() {
        this.currentTicket = [];
        this.selectedCustomer = null;
        this.appliedVoucher = null;
        this.discountPercent = 0;
        this.discountAmount = 0;
        this.discountType = 'percentage';

        const ticketCustomer = document.getElementById('ticketCustomer');
        if (ticketCustomer) {
            ticketCustomer.innerHTML = `<p><strong>Walk-in Customer</strong></p>`;
        }
        this.renderTicket();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.pm-card').forEach(card => {
        card.addEventListener('click', (e) => {
            document.querySelectorAll('.pm-card').forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    const posSearch = document.getElementById('posSearch');
    if (posSearch) {
        posSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const serviceButtons = document.querySelectorAll('.service-btn');
            serviceButtons.forEach(btn => {
                const text = btn.textContent.toLowerCase();
                btn.style.display = text.includes(term) ? '' : 'none';
            });
        });
    }

    // Update discount preview
    const discountValue = document.getElementById('discountValue');
    if (discountValue) {
        discountValue.addEventListener('input', () => {
            const subtotalText = document.getElementById('posSubtotal')?.textContent || 'Rs 0';
            const subtotal = parseFloat(subtotalText.replace('Rs ', '')) || 0;
            const value = parseFloat(discountValue.value) || 0;
            const type = document.querySelector('.discount-type-btn.active')?.getAttribute('data-type') || 'percentage';
            let preview = 0;
            if (type === 'percentage') {
                preview = subtotal * (value / 100);
            } else {
                preview = Math.min(value, subtotal);
            }
            const previewEl = document.getElementById('discountPreview');
            if (previewEl) previewEl.textContent = `Rs ${preview.toFixed(2)}`;
        });
    }
});
