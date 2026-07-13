const POS = {
    services: [],
    packageItems: [],
    currentTicket: [],
    selectedCustomer: null,
    appliedVoucher: null,
    discountPercent: 0,
    taxPercent: 0,
    savedBills: [],
    activeBillId: null,
    users: [],

    async loadServices() {
        try {
            const [services, inventory, packages, packageItems, users, settings] = await Promise.all([
                API.request("getServices").catch(() => []),
                API.request("getInventory").catch(() => []),
                API.request("getPackages").catch(() => []),
                API.request("getPackageItems").catch(() => []),
                API.request("getUsers").catch(() => []),
                API.request("getSettings").catch(() => ({}))
            ]);

            this.settings = settings || {};
            this.taxPercent = parseFloat(this.settings['TaxRate']) || 0;
            this.packageItems = packageItems || [];
            this.users = (users || []).filter(u => u.Status === "Active");

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
            this.initSavedBills(); // Initialize active tabs on load
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
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div>
                        <strong style="font-size: 0.95rem; color: var(--text-primary);">${customer.Name}</strong>
                        ${customer.Phone ? `<span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 8px;">(${customer.Phone})</span>` : ''}
                    </div>
                    <div style="font-size: 0.8rem; color: var(--primary-gold); font-weight: 700; display: flex; align-items: center; gap: 4px;">
                        <i class="fas fa-star"></i> ${customer.LoyaltyPoints || 0} pts
                    </div>
                </div>`;
        }
        UI.showToast(`Selected: ${customer.Name} (${customer.LoyaltyPoints || 0} pts)`);
        this.syncActiveBill();
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
                    PackageID: service.PackageID,
                    Quantity: 1
                });
            });

            UI.showToast(`Added package '${service.Name}' services to cart`);
            this.renderTicket();
            this.syncActiveBill();
        } else {
            this.currentTicket.push({
                ...service,
                uid: Date.now() + Math.random(),
                FinalPrice: parseFloat(service.Price) || 0,
                Quantity: 1
            });
            this.renderTicket();
            this.syncActiveBill();
        }
    },

    removeFromTicket(uid) {
        this.currentTicket = this.currentTicket.filter(item => String(item.uid) !== String(uid));
        this.renderTicket();
        this.syncActiveBill();
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
            const qty = item.Quantity || 1;
            const itemTotal = price * qty;
            subtotal += itemTotal;

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
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                    <!-- Inline Quantity Control -->
                    <div style="display: flex; align-items: center; gap: 6px; background: var(--border-color); border-radius: 20px; padding: 2px 8px;">
                        <button type="button" onclick="POS.updateItemQty('${item.uid}', -1)" style="border: none; background: none; color: var(--text-primary); cursor: pointer; font-weight: bold; padding: 0 4px; font-size: 0.85rem;" title="Decrease quantity">-</button>
                        <span style="font-weight: 700; font-size: 0.85rem; min-width: 14px; text-align: center;">${qty}</span>
                        <button type="button" onclick="POS.updateItemQty('${item.uid}', 1)" style="border: none; background: none; color: var(--text-primary); cursor: pointer; font-weight: bold; padding: 0 4px; font-size: 0.85rem;" title="Increase quantity">+</button>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; align-items: flex-end; justify-content: center; min-width: 75px;">
                        <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">Rs ${itemTotal.toFixed(0)}</span>
                        ${qty > 1 ? `<small style="font-size: 0.7rem; color: var(--text-muted);">Rs ${price.toFixed(0)} ea</small>` : ''}
                    </div>

                    <!-- Edit Details Button -->
                    <button class="ticket-row-edit-btn" type="button" onclick="POS.openEditItem('${item.uid}')" title="Edit service assignee or price">
                        <i class="fas fa-edit"></i>
                    </button>

                    <!-- Remove Item Button -->
                    <button class="remove-item" type="button" onclick="POS.removeFromTicket('${item.uid}')" title="Delete service">
                        <i class="fas fa-trash-alt" style="font-size: 0.85rem;"></i>
                    </button>
                </div>
            `;
            ticketDiv.appendChild(row);
        });

        this.updateTotals(subtotal);
        this.renderSavedBillsBar();
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

        const advanceRow = document.getElementById('posAdvanceRow');
        const advancePaidEl = document.getElementById('posAdvancePaid');
        const amountDueRow = document.getElementById('posAmountDueRow');
        const amountDueEl = document.getElementById('posAmountDue');

        let advancePaid = 0;
        if (this.activeAppointment) {
            advancePaid = parseFloat(this.activeAppointment.AdvancePaid || this.activeAppointment.advancePaid) || 0;
        }
        const amountDue = Math.max(0, total - advancePaid);

        if (subtotalEl) subtotalEl.textContent = `Rs ${subtotal.toFixed(2)}`;
        if (discountEl) discountEl.textContent = `- Rs ${(discountAmount + voucherDiscount).toFixed(2)}`;
        if (taxEl) taxEl.textContent = `Rs ${taxAmount.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `Rs ${total.toFixed(2)}`;

        if (advancePaid > 0) {
            if (advanceRow) advanceRow.style.display = 'flex';
            if (advancePaidEl) advancePaidEl.textContent = `- Rs ${advancePaid.toFixed(2)}`;
            if (amountDueRow) amountDueRow.style.display = 'flex';
            if (amountDueEl) amountDueEl.textContent = `Rs ${amountDue.toFixed(2)}`;
            if (amountEl) amountEl.value = amountDue.toFixed(2);
        } else {
            if (advanceRow) advanceRow.style.display = 'none';
            if (amountDueRow) amountDueRow.style.display = 'none';
            if (amountEl) amountEl.value = total.toFixed(2);
        }
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
        this.syncActiveBill();
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
        this.syncActiveBill();
    },

    handleSplitAmountChange(inputNum) {
        const totalText = document.getElementById('posTotal')?.textContent || 'Rs 0';
        const total = parseFloat(totalText.replace('Rs ', '')) || 0;
        const amount1El = document.getElementById('splitAmount1');
        const amount2El = document.getElementById('splitAmount2');
        const errEl = document.getElementById('splitError');

        if (!amount1El || !amount2El) return;

        let advancePaid = 0;
        if (this.activeAppointment) {
            advancePaid = parseFloat(this.activeAppointment.AdvancePaid || this.activeAppointment.advancePaid) || 0;
        }
        const targetAmount = Math.max(0, total - advancePaid);

        let val1 = parseFloat(amount1El.value) || 0;
        let val2 = parseFloat(amount2El.value) || 0;

        if (inputNum === 1) {
            val2 = Math.max(0, targetAmount - val1);
            amount2El.value = val2.toFixed(2);
        } else if (inputNum === 2) {
            val1 = Math.max(0, targetAmount - val2);
            amount1El.value = val1.toFixed(2);
        }

        if (Math.abs((val1 + val2) - targetAmount) > 0.05) {
            if (errEl) errEl.textContent = `Amounts must sum up to Rs ${targetAmount.toFixed(2)}`;
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

        let advancePaid = 0;
        if (this.activeAppointment) {
            advancePaid = parseFloat(this.activeAppointment.AdvancePaid || this.activeAppointment.advancePaid) || 0;
        }
        const amountDue = Math.max(0, total - advancePaid);

        let finalPaymentMethod = paymentMethod;
        if (advancePaid > 0) {
            const advanceMethod = this.activeAppointment.AdvanceMethod || this.activeAppointment.advanceMethod || "Cash";
            finalPaymentMethod = `${paymentMethod} (Advance Rs ${advancePaid.toFixed(0)} via ${advanceMethod} Applied)`;
        }
        let finalAmountReceived = amountReceived;
        let finalChange = paymentMethod !== 'Credit' ? amountReceived - amountDue : 0;
        let remainingBalance = paymentMethod === 'Credit' ? amountDue : 0;

        if (paymentMethod === 'Split') {
            const splitMethod1 = document.getElementById('splitMethod1').value;
            const splitAmount1 = parseFloat(document.getElementById('splitAmount1').value) || 0;
            const splitMethod2 = document.getElementById('splitMethod2').value;
            const splitAmount2 = parseFloat(document.getElementById('splitAmount2').value) || 0;

            if (Math.abs((splitAmount1 + splitAmount2) - amountDue) > 0.05) {
                UI.showToast(`Split amounts must sum up to Rs ${amountDue.toFixed(2)}`, "error");
                return;
            }

            if (splitMethod1 === 'Credit' || splitMethod2 === 'Credit') {
                if (!this.selectedCustomer || this.selectedCustomer.CustomerID === 'Walk-in') {
                    UI.showToast("Please select a customer to use Credit split payment!", "error");
                    return;
                }
            }

            finalPaymentMethod = `Split: ${splitMethod1} (Rs ${splitAmount1.toFixed(0)}) + ${splitMethod2} (Rs ${splitAmount2.toFixed(0)})`;
            if (advancePaid > 0) {
                const advanceMethod = this.activeAppointment.AdvanceMethod || this.activeAppointment.advanceMethod || "Cash";
                finalPaymentMethod += ` (Advance Rs ${advancePaid.toFixed(0)} via ${advanceMethod} Applied)`;
            }
            
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
                if (isNaN(amountReceived) || amountReceived < amountDue) {
                    UI.showToast("Amount received is less than amount due!", "error");
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

            // Update appointment status if booking checkout
            if (this.activeAppointment) {
                try {
                    await API.request("updateAppointment", {
                        apptId: this.activeAppointment.ApptID,
                        updateData: { Status: "Completed" }
                    });
                    if (typeof Bookings !== 'undefined') {
                        Bookings.load(); // reload bookings list
                    }
                } catch (apptErr) {
                    console.error("Failed to update appointment status:", apptErr);
                }
            }

            // Construct thermal receipt data BEFORE clearing the state
            const calculatedTax = (subtotal - totalDiscount) * (this.taxPercent / 100);
            const receiptData = {
                businessName: (this.settings && this.settings['BusinessName']) || 'La Cigal Salon & Spa',
                businessAddress: 'Plot #15, G-8 Markaz, Islamabad',
                businessPhone: '0300-1234567',
                invoiceNumber: result.invoiceNumber || 'N/A',
                date: new Date().toLocaleString('en-US', { hour12: true }),
                cashier: (window.Auth && Auth.currentUser) ? Auth.currentUser.Name : 'Cashier',
                customerName: this.selectedCustomer ? this.selectedCustomer.Name : 'Walk-in Customer',
                paymentMethod: finalPaymentMethod,
                items: this.currentTicket.map(item => ({
                    Name: item.Name,
                    Price: parseFloat(item.FinalPrice || item.Price) || 0,
                    Qty: item.Quantity || 1
                })),
                subtotal: subtotal,
                discount: totalDiscount,
                tax: calculatedTax,
                total: total,
                amountReceived: finalAmountReceived,
                change: finalChange,
                advancePaid: advancePaid,
                advanceMethod: advancePaid > 0 ? (this.activeAppointment.AdvanceMethod || this.activeAppointment.advanceMethod || "Cash") : ""
            };

            // Clear saved bill if active
            if (this.activeBillId) {
                this.savedBills = this.savedBills.filter(b => b.id !== this.activeBillId);
                this.activeBillId = null;
                this.saveBillsToStorage();
            }

            this.clear();
            UI.closeModal('checkoutModal');

            // Show the Receipt Modal immediately
            this.showReceiptModal(receiptData);

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
        this.activeBillId = null;
        this.activeAppointment = null;

        const mainDiscEl = document.getElementById('mainDiscount');
        if (mainDiscEl) mainDiscEl.value = 0;
        const checkoutDiscEl = document.getElementById('checkoutDiscount');
        if (checkoutDiscEl) checkoutDiscEl.value = 0;

        const ticketCustomer = document.getElementById('ticketCustomer');
        if (ticketCustomer) {
            ticketCustomer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">Walk-in Customer</span>
                </div>`;
        }
        this.renderTicket();
        this.renderSavedBillsBar();
    },

    /* ==========================================
       TAB PERSISTENCE & MULTI-CUSTOMER MECHANICS
       ========================================== */
    initSavedBills() {
        try {
            const stored = localStorage.getItem('pos_saved_bills');
            this.savedBills = stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error("Failed to load saved bills", e);
            this.savedBills = [];
        }
        this.renderSavedBillsBar();
    },

    saveBillsToStorage() {
        localStorage.setItem('pos_saved_bills', JSON.stringify(this.savedBills));
        this.renderSavedBillsBar();
    },

    syncActiveBill() {
        if (this.activeBillId) {
            const bill = this.savedBills.find(b => b.id === this.activeBillId);
            if (bill) {
                bill.ticket = JSON.parse(JSON.stringify(this.currentTicket));
                bill.selectedCustomer = this.selectedCustomer;
                bill.discountPercent = this.discountPercent;
                localStorage.setItem('pos_saved_bills', JSON.stringify(this.savedBills));
            }
        }
    },

    renderSavedBillsBar() {
        const bar = document.getElementById('activeTabsBar');
        if (!bar) return;

        let html = '';

        // Standard active/temp tab
        html += `
            <div class="tab-chip ${!this.activeBillId ? 'active' : ''}" onclick="POS.switchToTempBill()">
                <i class="fas fa-receipt"></i> Current Walk-in
            </div>
        `;

        // Render saved bills
        this.savedBills.forEach(bill => {
            const isActive = this.activeBillId === bill.id;
            const total = (bill.ticket || []).reduce((sum, item) => {
                const price = parseFloat(item.FinalPrice || item.Price) || 0;
                const qty = item.Quantity || 1;
                return sum + (price * qty);
            }, 0);
            
            html += `
                <div class="tab-chip ${isActive ? 'active' : ''}" onclick="POS.switchToBill('${bill.id}')">
                    <i class="fas fa-folder-open"></i> ${bill.label} (Rs ${total.toFixed(0)})
                    <span class="close-tab" onclick="event.stopPropagation(); POS.deleteBill('${bill.id}')" title="Delete tab"><i class="fas fa-times"></i></span>
                </div>
            `;
        });

        // New Tab Button
        html += `
            <button class="new-tab-btn" onclick="POS.openHoldBillModal()" title="Hold current bill">
                <i class="fas fa-plus"></i> Hold/Save
            </button>
        `;

        bar.innerHTML = html;
    },

    openHoldBillModal() {
        if (this.currentTicket.length === 0) {
            UI.showToast("Add some items to the bill before holding!", "warning");
            return;
        }
        
        // Prefill label with selected customer name if available
        const labelInput = document.getElementById('holdBillLabel');
        if (labelInput) {
            labelInput.value = this.selectedCustomer ? this.selectedCustomer.Name : '';
        }
        
        UI.openModal('holdBillModal');
    },

    confirmHoldBill() {
        const labelInput = document.getElementById('holdBillLabel');
        const label = labelInput ? labelInput.value.trim() : '';

        if (!label) {
            UI.showToast("Please enter a label for this tab!", "error");
            return;
        }

        // Create new saved bill
        const newBill = {
            id: 'bill_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            label: label,
            ticket: JSON.parse(JSON.stringify(this.currentTicket)),
            selectedCustomer: this.selectedCustomer,
            discountPercent: this.discountPercent,
            createdAt: new Date().toISOString()
        };

        this.savedBills.push(newBill);
        this.activeBillId = newBill.id;
        this.saveBillsToStorage();

        UI.closeModal('holdBillModal');
        UI.showToast(`Saved bill to hold: "${label}"`);
        
        // Switch to the saved bill we just created
        this.switchToBill(newBill.id);
    },

    switchToTempBill() {
        // Save current tab state if we are in a saved bill
        this.syncActiveBill();

        this.activeBillId = null;
        this.currentTicket = [];
        this.selectedCustomer = null;
        this.discountPercent = 0;

        // Reset fields in UI
        const mainDiscEl = document.getElementById('mainDiscount');
        if (mainDiscEl) mainDiscEl.value = 0;

        const ticketCustomer = document.getElementById('ticketCustomer');
        if (ticketCustomer) {
            ticketCustomer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">Walk-in Customer</span>
                </div>`;
        }

        this.renderTicket();
        this.renderSavedBillsBar();
    },

    switchToBill(id) {
        // Save current tab state if we are in a saved bill
        this.syncActiveBill();

        const bill = this.savedBills.find(b => b.id === id);
        if (bill) {
            this.activeBillId = bill.id;
            this.currentTicket = JSON.parse(JSON.stringify(bill.ticket || []));
            this.selectedCustomer = bill.selectedCustomer || null;
            this.discountPercent = bill.discountPercent || 0;

            // Update UI elements for discount & customer
            const mainDiscEl = document.getElementById('mainDiscount');
            if (mainDiscEl) mainDiscEl.value = this.discountPercent;

            const ticketCustomer = document.getElementById('ticketCustomer');
            if (ticketCustomer) {
                if (this.selectedCustomer) {
                    ticketCustomer.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div>
                                <strong style="font-size: 0.95rem; color: var(--text-primary);">${this.selectedCustomer.Name}</strong>
                                ${this.selectedCustomer.Phone ? `<span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 8px;">(${this.selectedCustomer.Phone})</span>` : ''}
                            </div>
                            <div style="font-size: 0.8rem; color: var(--primary-gold); font-weight: 700; display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-star"></i> ${this.selectedCustomer.LoyaltyPoints || 0} pts
                            </div>
                        </div>`;
                } else {
                    ticketCustomer.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">Walk-in Customer</span>
                        </div>`;
                }
            }

            this.renderTicket();
            this.renderSavedBillsBar();
            UI.showToast(`Loaded tab: "${bill.label}"`);
        }
    },

    deleteBill(id) {
        if (confirm("Are you sure you want to delete this active bill/tab? Any unsaved items will be lost.")) {
            this.savedBills = this.savedBills.filter(b => b.id !== id);
            if (this.activeBillId === id) {
                this.activeBillId = null;
                this.currentTicket = [];
                this.selectedCustomer = null;
                this.discountPercent = 0;
                this.renderTicket();
            }
            this.saveBillsToStorage();
            UI.showToast("Tab deleted successfully");
        }
    },

    updateItemQty(uid, delta) {
        const item = this.currentTicket.find(i => String(i.uid) === String(uid));
        if (item) {
            item.Quantity = (item.Quantity || 1) + delta;
            if (item.Quantity <= 0) {
                this.removeFromTicket(uid);
            } else {
                this.renderTicket();
                this.syncActiveBill();
            }
        }
    },

    openEditItem(uid) {
        const item = this.currentTicket.find(i => String(i.uid) === String(uid));
        if (!item) return;

        document.getElementById('editItemUid').value = uid;
        document.getElementById('editItemName').value = item.Name;
        document.getElementById('editItemPrice').value = parseFloat(item.FinalPrice || item.Price) || 0;
        document.getElementById('editItemQty').value = item.Quantity || 1;

        // Populate Staff dropdown
        const staffSelect = document.getElementById('editItemStaff');
        if (staffSelect) {
            staffSelect.innerHTML = `<option value="Any">Any Staff</option>` +
                (this.users || []).map(u => `<option value="${u.Name}">${u.Name}</option>`).join('');
            staffSelect.value = item.Staff || 'Any';
        }

        UI.openModal('editTicketItemModal');
    },

    saveTicketItemChanges() {
        const uid = document.getElementById('editItemUid').value;
        const price = parseFloat(document.getElementById('editItemPrice').value) || 0;
        const qty = parseInt(document.getElementById('editItemQty').value) || 1;
        const staff = document.getElementById('editItemStaff').value;

        const item = this.currentTicket.find(i => String(i.uid) === String(uid));
        if (item) {
            item.FinalPrice = price;
            item.Quantity = qty;
            item.Staff = staff;
            this.renderTicket();
            this.syncActiveBill();
            UI.closeModal('editTicketItemModal');
            UI.showToast("Item details updated");
        }
    },

    scrollCategories(amount) {
        const container = document.getElementById('posCategories');
        if (container) {
            container.scrollBy({ left: amount, behavior: 'smooth' });
        }
    },

    printDraftReceipt() {
        if (this.currentTicket.length === 0) {
            UI.showToast("Ticket is empty!", "error");
            return;
        }

        const subtotalText = document.getElementById('posSubtotal')?.textContent || 'Rs 0';
        const subtotal = parseFloat(subtotalText.replace('Rs ', ''));
        const discountText = document.getElementById('posDiscount')?.textContent || 'Rs 0';
        const discount = Math.abs(parseFloat(discountText.replace('- Rs ', '').replace('Rs ', '')));
        const taxText = document.getElementById('posTax')?.textContent || 'Rs 0';
        const tax = parseFloat(taxText.replace('Rs ', ''));
        const totalText = document.getElementById('posTotal')?.textContent || 'Rs 0';
        const total = parseFloat(totalText.replace('Rs ', ''));

        const draftData = {
            businessName: (this.settings && this.settings['BusinessName']) || 'La Cigal Salon & Spa',
            businessAddress: 'Plot #15, G-8 Markaz, Islamabad',
            businessPhone: '0300-1234567',
            invoiceNumber: 'DRAFT-' + Math.floor(100000 + Math.random() * 900000),
            date: new Date().toLocaleString('en-US', { hour12: true }),
            cashier: (window.Auth && Auth.currentUser) ? Auth.currentUser.Name : 'Cashier',
            customerName: this.selectedCustomer ? this.selectedCustomer.Name : 'Walk-in Customer',
            paymentMethod: 'DRAFT / UNPAID',
            items: this.currentTicket.map(item => ({
                Name: item.Name,
                Price: parseFloat(item.FinalPrice || item.Price) || 0,
                Qty: item.Quantity || 1
            })),
            subtotal: subtotal,
            discount: discount,
            tax: tax,
            total: total,
            amountReceived: 0,
            change: 0
        };

        this.showReceiptModal(draftData);
    },

    showReceiptModal(receiptData) {
        // Store receiptData so printThermalReceiptFromPreview can access it
        this.activeReceiptData = receiptData;

        const container = document.getElementById('receiptPreviewContainer');
        if (!container) return;

        // Render receipt preview styled like physical thermal paper
        container.innerHTML = `
            <div style="text-align: center; margin-bottom: 10px;">
                <h3 style="margin: 0 0 5px 0; font-size: 1.1rem; font-weight: bold; color: #000; letter-spacing: 0.5px; font-family: 'Courier New', Courier, monospace;">${receiptData.businessName.toUpperCase()}</h3>
                <div style="font-size: 0.75rem; color: #111; font-family: 'Courier New', Courier, monospace;">${receiptData.businessAddress}</div>
                <div style="font-size: 0.75rem; color: #111; font-family: 'Courier New', Courier, monospace;">Tel: ${receiptData.businessPhone}</div>
            </div>
            <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
            <div style="font-size: 0.75rem; line-height: 1.4; color: #000; font-family: 'Courier New', Courier, monospace;">
                <div><strong>Invoice:</strong> ${receiptData.invoiceNumber}</div>
                <div><strong>Date:</strong> ${receiptData.date}</div>
                <div><strong>Cashier:</strong> ${receiptData.cashier}</div>
                <div><strong>Customer:</strong> ${receiptData.customerName}</div>
                <div><strong>Payment:</strong> ${receiptData.paymentMethod}</div>
            </div>
            <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem; color: #000; font-family: 'Courier New', Courier, monospace;">
                <thead>
                    <tr style="border-bottom: 1px dashed #000;">
                        <th style="text-align: left; padding: 4px 0; width: 55%; font-weight: bold;">Item</th>
                        <th style="text-align: center; padding: 4px 0; width: 15%; font-weight: bold;">Qty</th>
                        <th style="text-align: right; padding: 4px 0; width: 30%; font-weight: bold;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${receiptData.items.map(item => `
                        <tr>
                            <td style="padding: 4px 0; vertical-align: top; text-align: left;">
                                ${item.Name}
                                ${item.Price ? `<br/><span style="font-size: 0.65rem; color: #333;">@ Rs ${parseFloat(item.Price).toFixed(0)}</span>` : ''}
                            </td>
                            <td style="text-align: center; padding: 4px 0; vertical-align: top;">${item.Qty || 1}</td>
                            <td style="text-align: right; padding: 4px 0; vertical-align: top;">Rs ${(item.Price * (item.Qty || 1)).toFixed(0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
            <div style="font-size: 0.75rem; color: #000; line-height: 1.4; font-family: 'Courier New', Courier, monospace;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Subtotal:</span>
                    <span>Rs ${receiptData.subtotal.toFixed(0)}</span>
                </div>
                ${receiptData.discount > 0 ? `
                <div style="display: flex; justify-content: space-between;">
                    <span>Discount:</span>
                    <span>- Rs ${receiptData.discount.toFixed(0)}</span>
                </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between;">
                    <span>Tax:</span>
                    <span>Rs ${receiptData.tax.toFixed(0)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 0.85rem; border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px;">
                    <span>TOTAL:</span>
                    <span>Rs ${receiptData.total.toFixed(0)}</span>
                </div>
                ${receiptData.advancePaid > 0 ? `
                <div style="display: flex; justify-content: space-between; color: #28a745; font-weight: bold; margin-top: 4px;">
                    <span>Advance Paid (${receiptData.advanceMethod || 'Cash'}):</span>
                    <span>- Rs ${parseFloat(receiptData.advancePaid).toFixed(0)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 0.8rem; border-top: 1px dashed #000; margin-top: 4px; padding-top: 4px;">
                    <span>Amount Due:</span>
                    <span>Rs ${(receiptData.total - receiptData.advancePaid).toFixed(0)}</span>
                </div>
                ` : ''}
                <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Amount Recd:</span>
                    <span>Rs ${receiptData.amountReceived.toFixed(0)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold;">
                    <span>Change:</span>
                    <span>Rs ${receiptData.change.toFixed(0)}</span>
                </div>
            </div>
            <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
            <div style="text-align: center; font-size: 0.7rem; color: #000; line-height: 1.3; font-family: 'Courier New', Courier, monospace;">
                <p style="margin: 0; font-weight: bold;">La Cigal Salon & Spa</p>
                <p style="margin: 3px 0 0 0;">Thank you for your visit!</p>
                <p style="margin: 3px 0 0 0; font-size: 0.6rem;">Software Powered by AI Studio</p>
            </div>
        `;

        UI.openModal('receiptModal');
    },

    printThermalReceiptFromPreview() {
        if (!this.activeReceiptData) {
            UI.showToast("No receipt data to print", "error");
            return;
        }
        this.printThermalReceipt(this.activeReceiptData);
    },

    printThermalReceipt(receiptData) {
        let printIframe = document.getElementById('receiptPrintIframe');
        if (!printIframe) {
            printIframe = document.createElement('iframe');
            printIframe.id = 'receiptPrintIframe';
            printIframe.style.position = 'absolute';
            printIframe.style.width = '0px';
            printIframe.style.height = '0px';
            printIframe.style.border = 'none';
            document.body.appendChild(printIframe);
        }

        const doc = printIframe.contentWindow.document;
        doc.open();
        doc.write(`
            <html>
            <head>
                <title>Receipt - ${receiptData.invoiceNumber}</title>
                <style>
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 11px;
                        line-height: 1.3;
                        color: #000;
                        background: #fff;
                        padding: 15px 10px;
                        width: 70mm;
                        box-sizing: border-box;
                        margin: 0;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .bold { font-weight: bold; }
                    .divider {
                        border-top: 1px dashed #000;
                        margin: 8px 0;
                    }
                    .header-title {
                        font-size: 14px;
                        font-weight: bold;
                        margin: 0 0 4px 0;
                    }
                    .info-table, .items-table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .info-table td, .items-table td, .items-table th {
                        padding: 2px 0;
                        font-size: 11px;
                    }
                    .items-table th {
                        text-align: left;
                        border-bottom: 1px dashed #000;
                        font-weight: bold;
                    }
                    .totals-section {
                        margin-top: 5px;
                        font-size: 11px;
                    }
                    .totals-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 1px 0;
                    }
                    .footer {
                        margin-top: 15px;
                        font-size: 9px;
                        line-height: 1.4;
                    }
                </style>
            </head>
            <body>
                <div class="text-center">
                    <div class="header-title">${receiptData.businessName.toUpperCase()}</div>
                    <div style="font-size: 9px;">${receiptData.businessAddress}</div>
                    <div style="font-size: 9px;">Tel: ${receiptData.businessPhone}</div>
                </div>
                <div class="divider"></div>
                <table class="info-table">
                    <tr><td><strong>Invoice:</strong> ${receiptData.invoiceNumber}</td></tr>
                    <tr><td><strong>Date:</strong> ${receiptData.date}</td></tr>
                    <tr><td><strong>Cashier:</strong> ${receiptData.cashier}</td></tr>
                    <tr><td><strong>Customer:</strong> ${receiptData.customerName}</td></tr>
                    <tr><td><strong>Payment:</strong> ${receiptData.paymentMethod}</td></tr>
                </table>
                <div class="divider"></div>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th style="width: 55%;">Item</th>
                            <th style="width: 15%; text-align: center;">Qty</th>
                            <th style="width: 30%; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${receiptData.items.map(item => `
                            <tr>
                                <td style="vertical-align: top;">
                                    ${item.Name}
                                    ${item.Price ? `<br/><span style="font-size: 8px; color: #333;">@ Rs ${parseFloat(item.Price).toFixed(0)}</span>` : ''}
                                </td>
                                <td style="text-align: center; vertical-align: top;">${item.Qty || 1}</td>
                                <td style="text-align: right; vertical-align: top;">Rs ${(item.Price * (item.Qty || 1)).toFixed(0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="divider"></div>
                <div class="totals-section">
                    <div class="totals-row">
                        <span>Subtotal:</span>
                        <span>Rs ${receiptData.subtotal.toFixed(0)}</span>
                    </div>
                    ${receiptData.discount > 0 ? `
                    <div class="totals-row">
                        <span>Discount:</span>
                        <span>- Rs ${receiptData.discount.toFixed(0)}</span>
                    </div>
                    ` : ''}
                    <div class="totals-row">
                        <span>Tax:</span>
                        <span>Rs ${receiptData.tax.toFixed(0)}</span>
                    </div>
                    <div class="totals-row bold" style="font-size: 12px; border-top: 1px dashed #000; margin-top: 4px; padding-top: 4px;">
                        <span>TOTAL:</span>
                        <span>Rs ${receiptData.total.toFixed(0)}</span>
                    </div>
                    ${receiptData.advancePaid > 0 ? `
                    <div class="totals-row bold" style="color: #28a745;">
                        <span>Advance Paid (${receiptData.advanceMethod || 'Cash'}):</span>
                        <span>- Rs ${parseFloat(receiptData.advancePaid).toFixed(0)}</span>
                    </div>
                    <div class="totals-row bold" style="font-size: 11px; border-top: 1px dashed #000; margin-top: 4px; padding-top: 4px;">
                        <span>Amount Due:</span>
                        <span>Rs ${(receiptData.total - receiptData.advancePaid).toFixed(0)}</span>
                    </div>
                    ` : ''}
                    <div class="divider"></div>
                    <div class="totals-row">
                        <span>Amount Received:</span>
                        <span>Rs ${receiptData.amountReceived.toFixed(0)}</span>
                    </div>
                    <div class="totals-row bold">
                        <span>Change:</span>
                        <span>Rs ${receiptData.change.toFixed(0)}</span>
                    </div>
                </div>
                <div class="divider"></div>
                <div class="text-center footer">
                    <p class="bold">La Cigal Salon & Spa</p>
                    <p>Thank you for your visit!</p>
                    <p style="font-size: 8px; color: #555; margin-top: 5px;">Software Powered by AI Studio</p>
                </div>
            </body>
            </html>
        `);
        doc.close();

        // Print iframe content cleanly
        setTimeout(() => {
            printIframe.contentWindow.focus();
            printIframe.contentWindow.print();
        }, 300);
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

    const posCategories = document.getElementById('posCategories');
    if (posCategories) {
        posCategories.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                posCategories.scrollLeft += e.deltaY;
            }
        }, { passive: false });
    }
});