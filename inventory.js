const Inventory = {
    data: [],
    selectedCategory: 'All',
    searchTerm: '',

    async load() {
        try {
            this.data = await API.request("getInventory");
            this.renderCategories();
            this.render();
        } catch (e) {
            console.error("Failed to load inventory", e);
            UI.showToast("Failed to load inventory", "error");
            this.data = [];
            this.renderCategories();
            this.render();
        }
    },

    renderCategories() {
        const container = document.getElementById('inventoryCategories');
        if (!container) return;

        // Extract unique categories from inventory
        const categories = ['All', ...new Set(this.data.map(item => item.Category || 'Uncategorized'))];

        container.innerHTML = categories.map(cat => `
            <div class="cat-card ${cat === this.selectedCategory ? 'active' : ''}" onclick="Inventory.filterByCategory('${cat}')">
                ${cat}
            </div>
        `).join('');
    },

    filterByCategory(category) {
        this.selectedCategory = category;
        this.renderCategories();
        this.render();
    },

    render() {
        const tbody = document.querySelector('#inventoryTable tbody');
        if (!tbody) {
            console.warn("Inventory table body not found");
            return;
        }
        
        tbody.innerHTML = "";

        // Apply filters
        const filtered = this.data.filter(item => {
            if (!item.SKU) return false;

            // Category filter
            const itemCat = item.Category || 'Uncategorized';
            const matchesCategory = this.selectedCategory === 'All' || itemCat === this.selectedCategory;

            // Search filter
            const name = String(item.Name || '').toLowerCase();
            const sku = String(item.SKU || '').toLowerCase();
            const search = String(this.searchTerm || '').toLowerCase();
            const matchesSearch = name.includes(search) || sku.includes(search);

            return matchesCategory && matchesSearch;
        });
        
        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">
                        No inventory items found matching the filter.
                    </td>
                </tr>
            `;
            return;
        }
        
        filtered.forEach(item => {
            const stock = parseInt(item.Stock) || 0;
            const minStock = parseInt(item.MinStock) || 5;
            const stockColor = stock > minStock ? 'var(--success)' : stock > 0 ? 'var(--primary-gold)' : 'var(--danger)';
            const stockStatus = stock > minStock ? 'In Stock' : stock > 0 ? 'Low Stock' : 'Out of Stock';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.Name || 'Unknown'}</td>
                <td>${item.SKU}</td>
                <td>${item.Category || 'Uncategorized'}</td>
                <td><strong style="color: ${stockColor}">${stock}</strong></td>
                <td>${minStock}</td>
                <td>Rs ${parseFloat(item.Price || 0).toLocaleString()}</td>
                <td><span class="badge ${stock > minStock ? 'badge-success' : 'badge-danger'}">${stockStatus}</span></td>
            `;
            tbody.appendChild(row);
        });
    },
    
    async save() {
        const name = document.getElementById('invName')?.value;
        const sku = document.getElementById('invSKU')?.value;
        const category = document.getElementById('invCategory')?.value;
        const stockInput = document.getElementById('invStock')?.value;
        const priceInput = document.getElementById('invPrice')?.value;
        const minStock = parseInt(document.getElementById('invMinStock')?.value) || 5;
        const purchasePrice = parseFloat(document.getElementById('invPurchasePrice')?.value) || 0;
        const expiry = document.getElementById('invExpiry')?.value || '';

        if (!name || !sku || !priceInput || stockInput === '') {
            UI.showToast('Please fill in required fields (Name, SKU, Stock, Price)', 'error');
            return;
        }

        const stock = parseInt(stockInput) || 0;
        const price = parseFloat(priceInput) || 0;

        if (price < 0 || stock < 0) {
            UI.showToast('Price and Stock must be positive values', 'error');
            return;
        }

        try {
            await API.request('addInventoryItem', { name, sku, category, stock, price, minStock, purchasePrice, expiry });
            UI.showToast('Product added successfully!');
            UI.closeModal('inventoryModal');
            document.getElementById('inventoryForm').reset();
            this.load();
        } catch (e) {
            UI.showToast('Failed to add product: ' + e.message, 'error');
            console.error('Inventory add error:', e);
        }
    },

    openBulkModal() {
        const tbody = document.getElementById('bulkStockTableBody');
        if (!tbody) return;

        tbody.innerHTML = "";

        if (this.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">
                        No inventory products available.
                    </td>
                </tr>
            `;
            UI.openModal('bulkStockModal');
            return;
        }

        this.data.forEach(item => {
            if (!item.SKU) return;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="font-weight: 600;">${item.Name || 'Unknown'}</td>
                <td><code>${item.SKU}</code></td>
                <td><span class="badge" style="background: rgba(255,255,255,0.05);">${item.Stock || 0}</span></td>
                <td>
                    <input type="number" class="bulk-add-input" data-sku="${item.SKU}" min="0" placeholder="0" 
                           style="width: 100px; padding: 6px 12px; border: 1px solid var(--border-color); 
                                  border-radius: 6px; background: var(--bg-color); color: var(--text-primary); 
                                  text-align: center; font-weight: bold; outline: none;">
                </td>
            `;
            tbody.appendChild(row);
        });

        UI.openModal('bulkStockModal');
    },

    async saveBulkStock() {
        const inputs = document.querySelectorAll('.bulk-add-input');
        const items = [];

        inputs.forEach(input => {
            const sku = input.getAttribute('data-sku');
            const addQty = parseInt(input.value) || 0;
            if (addQty > 0) {
                items.push({ SKU: sku, AddQty: addQty });
            }
        });

        if (items.length === 0) {
            UI.showToast("No stock changes entered.", "warning");
            UI.closeModal('bulkStockModal');
            return;
        }

        try {
            UI.showToast("Updating stock...", "info");
            const response = await API.request("bulkAddStock", { items });
            UI.showToast(`Successfully added stock to ${response.updated || items.length} products!`);
            UI.closeModal('bulkStockModal');
            this.load();
            
            // Also trigger POS reload so the updated stock is fetched in POS
            if (typeof POS !== 'undefined' && typeof POS.loadServices === 'function') {
                POS.loadServices();
            }
        } catch (e) {
            UI.showToast("Failed to bulk update stock: " + e.message, "error");
            console.error(e);
        }
    }
};

// Bind search input when DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    const invSearch = document.getElementById('inventorySearch');
    if (invSearch) {
        invSearch.addEventListener('input', (e) => {
            Inventory.searchTerm = e.target.value;
            Inventory.render();
        });
    }
});
