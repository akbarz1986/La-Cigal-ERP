const Suppliers = {
    data: [],
    inventory: [],

    async load() {
        try {
            [this.data, this.inventory] = await Promise.all([
                API.request("getSuppliers"),
                API.request("getInventory").catch(() => [])
            ]);
            this.render();
        } catch (e) {
            console.error("Failed to load suppliers", e);
            UI.showToast("Failed to load suppliers", "error");
            this.data = [];
            this.render();
        }
    },

    render() {
        const container = document.getElementById('supplierList');
        if (!container) return;

        if (this.data.length === 0) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-truck"></i><p>No suppliers added yet.</p></div>`;
            return;
        }

        container.innerHTML = `
            <div class="customer-grid">
                ${this.data.map(s => `
                    <div class="service-btn">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <h4>${s.Name || 'Unknown'}</h4>
                            <span class="badge badge-info">${s.PaymentTerms || '30 Days'}</span>
                        </div>
                        <div style="color:var(--text-muted);font-size:0.9rem;margin-top:8px;">
                            <p><i class="fas fa-building"></i> ${s.Company || 'N/A'}</p>
                            <p><i class="fas fa-phone"></i> ${s.Phone || 'N/A'}</p>
                            <p><i class="fas fa-envelope"></i> ${s.Email || 'N/A'}</p>
                        </div>
                        <div style="display:flex;gap:8px;margin-top:12px;">
                            <button class="btn btn-primary" style="flex:1;padding:8px;" onclick="Suppliers.openPOModal('${s.SupplierID}','${(s.Name||'').replace(/'/g,"\\'")}')">
                                <i class="fas fa-file-invoice"></i> Create PO
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>`;
    },

    async save() {
        const name = document.getElementById('suppName')?.value;
        const company = document.getElementById('suppCompany')?.value;
        const contactPerson = document.getElementById('suppContact')?.value;
        const phone = document.getElementById('suppPhone')?.value;
        const email = document.getElementById('suppEmail')?.value;
        const address = document.getElementById('suppAddress')?.value;
        const paymentTerms = document.getElementById('suppPaymentTerms')?.value;

        if (!name || !phone) {
            UI.showToast("Name and Phone are required", "error");
            return;
        }

        try {
            await API.request("addSupplier", { name, company, contactPerson, phone, email, address, paymentTerms });
            UI.showToast("Supplier added successfully!");
            UI.closeModal('supplierModal');
            document.getElementById('supplierForm').reset();
            this.load();
        } catch (e) {
            UI.showToast("Failed to add supplier: " + e.message, "error");
        }
    },

    openPOModal(supplierID, supplierName) {
        document.getElementById('poSupplierID').value = supplierID;
        document.getElementById('poSupplierName').textContent = supplierName;
        document.getElementById('poItemsBody').innerHTML = '';
        this.addPOItem();
        UI.openModal('purchaseOrderModal');
    },

    addPOItem() {
        const body = document.getElementById('poItemsBody');
        if (!body) return;

        const row = document.createElement('tr');
        const inventoryOptions = this.inventory
            .map(i => `<option value="${i.ProductID}" data-price="${i.PurchasePrice || 0}">${i.Name} (${i.SKU || ''})</option>`)
            .join('');

        row.innerHTML = `
            <td>
                <select class="po-product-select" style="width:100%;padding:6px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-color);color:var(--text-primary);">
                    <option value="">-- Select Product --</option>
                    ${inventoryOptions}
                </select>
            </td>
            <td><input type="number" class="po-qty" min="1" value="1" style="width:70px;padding:6px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-color);color:var(--text-primary);"></td>
            <td><input type="number" class="po-price" min="0" value="0" style="width:100px;padding:6px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-color);color:var(--text-primary);"></td>
            <td><button type="button" onclick="this.closest('tr').remove()" style="background:var(--danger);color:#fff;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;"><i class="fas fa-trash"></i></button></td>
        `;

        // Auto-fill price when product is selected
        row.querySelector('.po-product-select').addEventListener('change', function() {
            const opt = this.options[this.selectedIndex];
            row.querySelector('.po-price').value = opt.dataset.price || 0;
        });

        body.appendChild(row);
    },

    async savePO() {
        const supplierID = document.getElementById('poSupplierID')?.value;
        const expectedDelivery = document.getElementById('poDeliveryDate')?.value;
        const rows = document.querySelectorAll('#poItemsBody tr');

        const items = [];
        let totalCost = 0;

        rows.forEach(row => {
            const productID = row.querySelector('.po-product-select')?.value;
            const quantity = parseInt(row.querySelector('.po-qty')?.value || 0);
            const costPrice = parseFloat(row.querySelector('.po-price')?.value || 0);
            if (productID && quantity > 0) {
                items.push({ productID, quantity, costPrice });
                totalCost += quantity * costPrice;
            }
        });

        if (!supplierID || items.length === 0) {
            UI.showToast("Please add at least one item", "error");
            return;
        }

        try {
            const result = await API.request("addPurchaseOrder", { supplierID, expectedDelivery, items, totalCost });
            UI.showToast("Purchase Order " + result.poID + " created!");
            UI.closeModal('purchaseOrderModal');
        } catch (e) {
            UI.showToast("Failed to create PO: " + e.message, "error");
        }
    }
};
