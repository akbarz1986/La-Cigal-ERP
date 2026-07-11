const Packages = {
    data: [],
    itemsData: [],
    services: [],
    currentItems: [], // Temporary items list for package being created/edited

    async load() {
        try {
            const [packages, items, services] = await Promise.all([
                API.request("getPackages").catch(() => []),
                API.request("getPackageItems").catch(() => []),
                API.request("getServices").catch(() => [])
            ]);

            this.data = packages || [];
            this.itemsData = items || [];
            this.services = services || [];

            this.render();
            this.populateServiceDropdown();
        } catch (e) {
            console.error("Failed to load packages data", e);
            UI.showToast("Failed to load packages data", "error");
        }
    },

    render() {
        const container = document.getElementById('packageList');
        if (!container) return;

        const searchQuery = document.getElementById('packageSearch')?.value?.toLowerCase() || '';
        const filtered = this.data.filter(p => 
            (p.Name || '').toLowerCase().includes(searchQuery) ||
            (p.Description || '').toLowerCase().includes(searchQuery) ||
            (p.PackageID || '').toLowerCase().includes(searchQuery)
        );

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <p>No packages found. Create one to get started!</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Package ID</th>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Services Included</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(p => {
                        // Find included services
                        const items = this.itemsData.filter(item => item.PackageID === p.PackageID);
                        const servicesNames = items.map(item => {
                            const srv = this.services.find(s => s.ServiceID === item.ServiceID);
                            return srv ? srv.Name : 'Unknown Service';
                        }).join(', ');

                        const statusClass = p.Status === 'Active' ? 'badge-success' : 'badge-danger';

                        return `
                            <tr>
                                <td><strong>${p.PackageID}</strong></td>
                                <td><strong>${p.Name}</strong></td>
                                <td class="text-muted" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    ${p.Description || '-'}
                                </td>
                                <td style="max-width: 300px; font-size: 0.9rem;">
                                    ${servicesNames || '<em class="text-muted">No services</em>'}
                                </td>
                                <td><strong style="color:var(--primary-gold)">Rs ${parseFloat(p.Price || 0).toLocaleString()}</strong></td>
                                <td><span class="badge ${statusClass}">${p.Status || 'Active'}</span></td>
                                <td>
                                    <div style="display:flex; gap:10px;">
                                        <button class="btn btn-outline" style="padding: 6px 12px; font-size: 0.85rem;" onclick="Packages.openEditModal('${p.PackageID}')">
                                            <i class="fas fa-edit"></i> Edit
                                        </button>
                                        <button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.85rem; background: var(--danger); border-color: var(--danger);" onclick="Packages.delete('${p.PackageID}')">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>`;
    },

    populateServiceDropdown() {
        const select = document.getElementById('pkgServiceSelect');
        if (!select) return;

        select.innerHTML = '<option value="">-- Choose a Service --</option>' + 
            this.services.map(s => `<option value="${s.ServiceID}">${s.Name} (Rs ${s.Price})</option>`).join('');
        
        this.onServiceSelectChange();
    },

    onServiceSelectChange() {
        const select = document.getElementById('pkgServiceSelect');
        const origPriceInput = document.getElementById('pkgServiceOrigPrice');
        const discountInput = document.getElementById('pkgServiceDiscountPercent');

        if (!select || !origPriceInput) return;

        const serviceId = select.value;
        const srv = this.services.find(s => s.ServiceID === serviceId);

        if (srv) {
            origPriceInput.value = srv.Price || 0;
            if (discountInput) discountInput.value = 0;
        } else {
            origPriceInput.value = 0;
            if (discountInput) discountInput.value = 0;
        }
    },

    onDiscountPercentInput() {
        // Just bounds check
        const input = document.getElementById('pkgServiceDiscountPercent');
        if (input) {
            let val = parseFloat(input.value) || 0;
            if (val < 0) input.value = 0;
            if (val > 100) input.value = 100;
        }
    },

    addServiceItem() {
        const select = document.getElementById('pkgServiceSelect');
        const serviceId = select?.value;
        if (!serviceId) {
            UI.showToast("Please select a service first", "error");
            return;
        }

        const srv = this.services.find(s => s.ServiceID === serviceId);
        if (!srv) return;

        const origPrice = parseFloat(srv.Price) || 0;
        const discountPercent = parseFloat(document.getElementById('pkgServiceDiscountPercent')?.value) || 0;
        const discountAmount = origPrice * (discountPercent / 100);
        const finalPrice = origPrice - discountAmount;

        // Add to current package build
        this.currentItems.push({
            ServiceID: serviceId,
            OriginalPrice: origPrice,
            DiscountPercent: discountPercent,
            DiscountAmount: discountAmount,
            FinalPrice: finalPrice,
            Name: srv.Name
        });

        this.renderCurrentItems();
        
        // Reset inputs
        select.value = "";
        this.onServiceSelectChange();
    },

    removeServiceItem(index) {
        this.currentItems.splice(index, 1);
        this.renderCurrentItems();
    },

    updateItemCalculations(index, field, value) {
        const item = this.currentItems[index];
        if (!item) return;

        const orig = parseFloat(item.OriginalPrice) || 0;
        let discountPercent = parseFloat(item.DiscountPercent) || 0;
        let discountAmount = parseFloat(item.DiscountAmount) || 0;
        let finalPrice = parseFloat(item.FinalPrice) || 0;

        if (field === 'percent') {
            discountPercent = Math.max(0, Math.min(100, parseFloat(value) || 0));
            discountAmount = orig * (discountPercent / 100);
            finalPrice = orig - discountAmount;
        } else if (field === 'amount') {
            discountAmount = Math.max(0, Math.min(orig, parseFloat(value) || 0));
            discountPercent = orig > 0 ? (discountAmount / orig) * 100 : 0;
            finalPrice = orig - discountAmount;
        } else if (field === 'final') {
            finalPrice = Math.max(0, Math.min(orig, parseFloat(value) || 0));
            discountAmount = orig - finalPrice;
            discountPercent = orig > 0 ? (discountAmount / orig) * 100 : 0;
        }

        item.DiscountPercent = discountPercent;
        item.DiscountAmount = discountAmount;
        item.FinalPrice = finalPrice;

        this.renderCurrentItems();
    },

    renderCurrentItems() {
        const tbody = document.getElementById('pkgItemsBody');
        if (!tbody) return;

        if (this.currentItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No services added to this package yet.</td></tr>`;
            this.updateTotalPackagePrice();
            return;
        }

        tbody.innerHTML = this.currentItems.map((item, index) => {
            return `
                <tr>
                    <td><strong>${item.Name || 'Service'}</strong></td>
                    <td>Rs ${parseFloat(item.OriginalPrice || 0).toFixed(0)}</td>
                    <td>
                        <input type="number" step="any" min="0" max="100" class="table-input" value="${parseFloat(item.DiscountPercent || 0).toFixed(1)}" 
                            style="width: 70px; text-align: center; padding: 4px;" 
                            oninput="Packages.updateItemCalculations(${index}, 'percent', this.value)">
                    </td>
                    <td>
                        <input type="number" step="any" min="0" class="table-input" value="${parseFloat(item.DiscountAmount || 0).toFixed(0)}" 
                            style="width: 80px; text-align: center; padding: 4px;" 
                            oninput="Packages.updateItemCalculations(${index}, 'amount', this.value)">
                    </td>
                    <td>
                        <input type="number" step="any" min="0" class="table-input" value="${parseFloat(item.FinalPrice || 0).toFixed(0)}" 
                            style="width: 80px; text-align: center; padding: 4px; font-weight: 600; color: var(--primary-gold);" 
                            oninput="Packages.updateItemCalculations(${index}, 'final', this.value)">
                    </td>
                    <td>
                        <button type="button" class="icon-btn text-danger" onclick="Packages.removeServiceItem(${index})">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        this.updateTotalPackagePrice();
    },

    updateTotalPackagePrice() {
        const priceInput = document.getElementById('pkgPrice');
        if (!priceInput) return;

        // Auto sum all item final prices
        const total = this.currentItems.reduce((sum, item) => sum + (parseFloat(item.FinalPrice) || 0), 0);
        priceInput.value = Math.round(total);
    },

    openNewModal() {
        document.getElementById('packageForm').reset();
        document.getElementById('pkgId').value = "";
        document.getElementById('packageModalTitle').textContent = "Create New Package";
        
        this.currentItems = [];
        this.renderCurrentItems();
        this.populateServiceDropdown();
        
        UI.openModal('packageModal');
    },

    openEditModal(packageId) {
        const pkg = this.data.find(p => p.PackageID === packageId);
        if (!pkg) return;

        document.getElementById('pkgId').value = pkg.PackageID;
        document.getElementById('pkgName').value = pkg.Name || "";
        document.getElementById('pkgPrice').value = pkg.Price || 0;
        document.getElementById('pkgStatus').value = pkg.Status || "Active";
        document.getElementById('pkgDescription').value = pkg.Description || "";

        document.getElementById('packageModalTitle').textContent = `Edit Package: ${pkg.PackageID}`;

        // Find package items and pre-fill
        const items = this.itemsData.filter(item => item.PackageID === packageId);
        this.currentItems = items.map(item => {
            const srv = this.services.find(s => s.ServiceID === item.ServiceID);
            return {
                ServiceID: item.ServiceID,
                OriginalPrice: parseFloat(item.OriginalPrice) || 0,
                DiscountPercent: parseFloat(item.DiscountPercent) || 0,
                DiscountAmount: parseFloat(item.DiscountAmount) || 0,
                FinalPrice: parseFloat(item.FinalPrice) || 0,
                Name: srv ? srv.Name : 'Unknown Service'
            };
        });

        this.renderCurrentItems();
        this.populateServiceDropdown();

        UI.openModal('packageModal');
    },

    async save() {
        const id = document.getElementById('pkgId').value;
        const name = document.getElementById('pkgName').value;
        const price = parseFloat(document.getElementById('pkgPrice').value);
        const status = document.getElementById('pkgStatus').value;
        const description = document.getElementById('pkgDescription').value;

        if (!name || isNaN(price) || price < 0) {
            UI.showToast("Please fill all required fields", "error");
            return;
        }

        if (this.currentItems.length === 0) {
            UI.showToast("Please add at least one service to the package", "error");
            return;
        }

        const payload = {
            name,
            price,
            status,
            description,
            items: this.currentItems
        };

        try {
            if (id) {
                // Edit
                payload.PackageID = id;
                await API.request("updatePackage", payload);
                UI.showToast("Package updated successfully!");
            } else {
                // Create
                await API.request("addPackage", payload);
                UI.showToast("Package created successfully!");
            }

            UI.closeModal('packageModal');
            
            // Reload all packages data
            await this.load();
            
            // Reload POS services list too to instantly reflect changes
            if (typeof POS !== 'undefined' && POS.loadServices) {
                POS.loadServices();
            }
        } catch (e) {
            UI.showToast("Failed to save package: " + e.message, "error");
        }
    },

    async delete(packageId) {
        const confirmed = window.confirm(`Are you sure you want to delete package ${packageId}? This cannot be undone.`);
        if (!confirmed) return;

        try {
            await API.request("deletePackage", { PackageID: packageId });
            UI.showToast("Package deleted successfully!");
            
            await this.load();
            
            if (typeof POS !== 'undefined' && POS.loadServices) {
                POS.loadServices();
            }
        } catch (e) {
            UI.showToast("Failed to delete package: " + e.message, "error");
        }
    }
};
