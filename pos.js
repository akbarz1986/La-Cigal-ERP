const POS = {
    services: [],
    packageItems: [],
    currentTicket: [],
    selectedCustomer: null,
    appliedVoucher: null,
    discountPercent: 0,
    taxPercent: 0,

    async loadServices() {
        try {
            const [services, inventory, packages, packageItems] = await Promise.all([
                API.request("getServices").catch(() => []),
                API.request("getInventory").catch(() => []),
                API.request("getPackages").catch(() => []),
                API.request("getPackageItems").catch(() => [])
            ]);

            this.packageItems = packageItems || [];

            const formattedServices = (services || []).map(s => ({ ...s, Type: "Service" }));
            const formattedInventory = (inventory || [])
                .filter(i => !i.Status || i.Status === "Active")
                .map(i => ({
                    ServiceID: i.SKU,
                    ProductID: i.SKU,
                    SKU: i.SKU,
                    Name: i.Name,
                    Price: parseFloat(i.Price) || 0,
                    Status: "Active",
                    Type: "Retail",
                    Stock: parseInt(i.Stock) || 0,
                    Category: i.Category || "Retail"
                }));
            const formattedPackages = (packages || [])
                .filter(p => p.Status === "Active")
                .map(p => ({
                    ServiceID: p.PackageID,
                    PackageID: p.PackageID,
                    Name: p.Name,
                    Price: p.Price || 0,
                    Status: p.Status || "Active",
                    Type: "Package",
                    Category: "Packages",
                    Description: p.Description || ""
                }));

            this.services = [...formattedServices, ...formattedInventory, ...formattedPackages];
            this.renderCategories();
            this.renderServices();
        } catch (e) {
            console.error("Failed to load POS items", e);
            UI.showToast("Failed to load POS items", "error");
        }
    },

    renderCategories() {
        const container = document.getElementById('posCategories');
        if (!container) return;

        // Custom list starting with 'All', then '📦 Stock / Products', then other categories from services
        const categories = [
            'All', 
            '📦 Stock Items',
            ...new Set(this.services.filter(s => s.Type !== 'Retail').map(s => s.Category || s.Type || 'Service')),
            ...new Set(this.services.filter(s => s.Type === 'Retail').map(s => s.Category || 'Retail'))
        ];

        const uniqueCategories = [...new Set(categories)];

        container.innerHTML = uniqueCategories.map((cat, i) => `
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

        let filtered = [];
        if (category === 'All') {
            filtered = this.services;
        } else if (category === '📦 Stock Items') {
            filtered = this.services.filter(s => s.Type === 'Retail');
        } else {
            filtered = this.services.filter(s => (s.Category || s.Type) === category);
        }

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
        if (service.Type === "Package") {
            const items = this.packageItems.filter(item => item.PackageID === service.PackageID);
            if (items.length === 0) {
                UI.showToast("No services defined in this package!", "warning");
                return;
            }

            items.forEach(item => {
                const srv = this.services.find(s => s.ServiceID === item.ServiceID);
                const srvName = srv ? srv.Name : `Unknown Service (${item.ServiceID})`;

                this.currentTicket.push({
                    ServiceID: item.ServiceID,
                    Name: `${srvName} (Pkg: ${service.Name})`,
                    Price: parseFloat(item.OriginalPrice) || 0,
                    FinalPrice: parseFloat(item.FinalPrice) || 0,
                    Type: "Service",
                    Category: srv ? srv.Category : "Service",
                    uid: Date.now() + Math.random(),
                    isPackageComponent: true,
                    PackageID: service.PackageID
                });
            });

            UI.showToast(`Added package '${service.Name}' services to cart`);
            this.renderTicket();
        } else {
            this.currentTicket.push({
                ...service,
                uid: Date.now() + Math.random(),
                FinalPrice: parseFloat(service.Price) || 0
            });
            this.renderTicket();
        }
    },

    removeFromTicket(uid) {
        this.currentTicket = this.currentTicket.filter(item => String(item.uid) !== String(uid));
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
            if (item.isPackageComponent) {
                row.classList.add('border-package');
            } else if (item.Type === 'Retail') {
                row.classList.add('border-retail');
            }

            row.innerHTML = `
                <div style="flex: 1; min-width: 0; padding-right: 10px;">
                    <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem; line-height: 1.2; word-break: break-word;">${item.Name}</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 5px;">
                        ${item.isPackageComponent ? '<span style="font-size:0.65rem; padding: 2px 6px; background: rgba(232, 67, 147, 0.1); color: #e84393; font-weight: bold; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px;">Package Component</span>' : ''}
                        ${item.Type === 'Retail' ? '<span style="font-size:0.65rem; padding: 2px 6px; background: rgba(9, 132, 227, 0.1); color: #0984e3; font-weight: bold; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px;">Retail</span>' : ''}
                        <span style="font-size:0.75rem; color: var(--text-muted); font-weight: 500;"><i class="far fa-user" style="margin-right: 3px;"></i> Staff: ${item.Staff || 'Any'}</span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                    <span style="font-weight: 700; font-size: 1rem; color: var(--text-primary);">Rs ${price.toFixed(2)}</span>
                    <button class="remove-item" type="button" onclick="POS.removeFromTicket('${item.uid}')" title="Delete service">
                        <i class="fas fa-trash-alt" style="font-size: 0.85rem;"></i>
                    </button>
                </div>
            `;
            ticketDiv.appendChild(row);
        });

        this.updateTotals(subtotal);
    },

    updateTotals(subtotal) {
        // Apply discount
        const discountAmount = subtotal * (this.discountPercent / 100);
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

        // Reset payment methods selection to "Cash" as default
        document.querySelectorAll('.pm-card').forEach(c => {
            if (c.getAttribute('data-method') === 'Cash') {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });

        // Hide split payment details by default
        const splitDetails = document.getElementById('splitPaymentDetails');
        if (splitDetails) splitDetails.classList.add('hidden');

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

        // Sync with main page discount input
        const mainDiscEl = document.getElementById('mainDiscount');
        if (mainDiscEl) {
            mainDiscEl.value = this.discountPercent;
        }

        const totalText = document.getElementById('posSubtotal')?.textContent || 'Rs 0';
        const subtotal = parseFloat(totalText.replace('Rs ', '')) || 0;
        this.updateTotals(subtotal);
    },

    applyMainDiscount() {
        const discEl = document.getElementById('mainDiscount');
        this.discountPercent = parseFloat(discEl?.value || 0);

        // Sync with checkout modal discount input
        const checkoutDiscEl = document.getElementById('checkoutDiscount');
        if (checkoutDiscEl) {
            checkoutDiscEl.value = this.discountPercent;
        }

        const totalText = document.getElementById('posSubtotal')?.textContent || 'Rs 0';
        const subtotal = parseFloat(totalText.replace('Rs ', '')) || 0;
        this.updateTotals(subtotal);
    },

    handleSplitAmountChange(inputNum) {
        const totalText = document.getElementById('posTotal')?.textContent || 'Rs 0';
        const total = parseFloat(totalText.replace('Rs ', '')) || 0;
        const amount1El = document.getElementById('splitAmount1');
        const amount2El = document.getElementById('splitAmount2');
        const errEl = document.getElementById('splitError');

        if (!amount1El || !amount2El) return;

        let val1 = parseFloat(amount1El.value) || 0;
        let val2 = parseFloat(amount2El.value) || 0;

        if (inputNum === 1) {
            val2 = Math.max(0, total - val1);
            amount2El.value = val2.toFixed(2);
        } else if (inputNum === 2) {
            val1 = Math.max(0, total - val2);
            amount1El.value = val1.toFixed(2);
        }

        if (Math.abs((val1 + val2) - total) > 0.05) {
            if (errEl) errEl.textContent = `Amounts must sum up to Rs ${total.toFixed(2)}`;
        } else {
            if (errEl) errEl.textContent = "";
        }
    },

    async finalizePayment() {
        const totalText = document.getElementById('posTotal')?.textContent || 'Rs 0';
        const total = parseFloat(totalText.replace('Rs ', ''));
        const amountReceived = parseFloat(document.getElementById('amountReceived')?.value || 0);
        const selectedPM = document.querySelector('.pm-card.active');
        const paymentMethod = selectedPM ? selectedPM.getAttribute('data-method') : 'Cash';

        let finalPaymentMethod = paymentMethod;
        let finalAmountReceived = amountReceived;
        let finalChange = paymentMethod !== 'Credit' ? amountReceived - total : 0;
        let remainingBalance = paymentMethod === 'Credit' ? total : 0;

        if (paymentMethod === 'Split') {
            const splitMethod1 = document.getElementById('splitMethod1').value;
            const splitAmount1 = parseFloat(document.getElementById('splitAmount1').value) || 0;
            const splitMethod2 = document.getElementById('splitMethod2').value;
            const splitAmount2 = parseFloat(document.getElementById('splitAmount2').value) || 0;

            if (Math.abs((splitAmount1 + splitAmount2) - total) > 0.05) {
                UI.showToast(`Split amounts must sum up to Rs ${total.toFixed(2)}`, "error");
                return;
            }

            if (splitMethod1 === 'Credit' || splitMethod2 === 'Credit') {
                if (!this.selectedCustomer || this.selectedCustomer.CustomerID === 'Walk-in') {
                    UI.showToast("Please select a customer to use Credit split payment!", "error");
                    return;
                }
            }

            finalPaymentMethod = `Split: ${splitMethod1} (Rs ${splitAmount1.toFixed(0)}) + ${splitMethod2} (Rs ${splitAmount2.toFixed(0)})`;
            
            let creditPortion = 0;
            if (splitMethod1 === 'Credit') creditPortion += splitAmount1;
            if (splitMethod2 === 'Credit') creditPortion += splitAmount2;
            remainingBalance = creditPortion;

            let receivedPortion = 0;
            if (splitMethod1 !== 'Credit') receivedPortion += splitAmount1;
            if (splitMethod2 !== 'Credit') receivedPortion += splitAmount2;
            
            finalAmountReceived = receivedPortion;
            finalChange = 0;
        } else {
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
        }

        const subtotalText = document.getElementById('posSubtotal')?.textContent || 'Rs 0';
        const subtotal = parseFloat(subtotalText.replace('Rs ', ''));

        const billDiscount = subtotal * (this.discountPercent / 100);
        const voucherDiscount = this.appliedVoucher ? (
            this.appliedVoucher.type === 'Percentage'
                ? (subtotal - billDiscount) * (this.appliedVoucher.value / 100)
                : Math.min(this.appliedVoucher.value, subtotal - billDiscount)
        ) : 0;
        const totalDiscount = billDiscount + voucherDiscount;

        const payload = {
            customerID: this.selectedCustomer ? this.selectedCustomer.CustomerID : "Walk-in",
            customerName: this.selectedCustomer ? this.selectedCustomer.Name : "Walk-in Customer",
            subtotal: subtotal,
            billDiscount: billDiscount,
            voucherDiscounts: voucherDiscount,
            discount: totalDiscount,
            tax: 0,
            total: total,
            paymentMethod: finalPaymentMethod,
            items: this.currentTicket,
            amountReceived: finalAmountReceived,
            change: finalChange,
            voucherCode: this.appliedVoucher ? this.appliedVoucher.code : null,
            remainingBalance: remainingBalance
        };

        try {
            const result = await API.request("processPayment", payload);
            let successMsg = `Payment Successful! Invoice: ${result.invoiceNumber || 'N/A'}`;
            if (paymentMethod !== 'Credit' && paymentMethod !== 'Split' && finalChange > 0) {
                successMsg += ` | Change: Rs ${finalChange.toFixed(2)}`;
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

        const mainDiscEl = document.getElementById('mainDiscount');
        if (mainDiscEl) mainDiscEl.value = 0;
        const checkoutDiscEl = document.getElementById('checkoutDiscount');
        if (checkoutDiscEl) checkoutDiscEl.value = 0;

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
            const clicked = e.currentTarget;
            clicked.classList.add('active');

            const method = clicked.getAttribute('data-method');
            const splitDetails = document.getElementById('splitPaymentDetails');
            if (splitDetails) {
                if (method === 'Split') {
                    splitDetails.classList.remove('hidden');
                    
                    // Initialize split amounts based on the current POS total
                    const totalText = document.getElementById('posTotal')?.textContent || 'Rs 0';
                    const total = parseFloat(totalText.replace('Rs ', '')) || 0;
                    
                    const amount1El = document.getElementById('splitAmount1');
                    const amount2El = document.getElementById('splitAmount2');
                    if (amount1El && amount2El) {
                        amount1El.value = (total / 2).toFixed(2);
                        amount2El.value = (total - parseFloat(amount1El.value)).toFixed(2);
                    }
                    const errEl = document.getElementById('splitError');
                    if (errEl) errEl.textContent = "";
                } else {
                    splitDetails.classList.add('hidden');
                }
            }
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
});