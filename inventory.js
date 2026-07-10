const Inventory = {
    data: [],

    async load() {
        try {
            this.data = await API.request("getInventory");
            this.render();
        } catch (e) {
            console.error("Failed to load inventory", e);
            UI.showToast("Failed to load inventory", "error");
            // Fallback to empty state
            this.data = [];
            this.render();
        }
    },

    render() {
        const tbody = document.querySelector('#inventoryTable tbody');
        if (!tbody) {
            console.warn("Inventory table body not found");
            return;
        }
        
        tbody.innerHTML = "";
        
        if (this.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">
                        No inventory items found. Add your first product.
                    </td>
                </tr>
            `;
            return;
        }
        
        this.data.forEach(item => {
            if (!item.SKU) return;
            
            const stockColor = item.Stock > 10 ? 'var(--success)' : item.Stock > 0 ? 'var(--primary-gold)' : 'var(--danger)';
            const stockStatus = item.Stock > 10 ? 'In Stock' : item.Stock > 0 ? 'Low Stock' : 'Out of Stock';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.Name || 'Unknown'}</td>
                <td>${item.SKU}</td>
                <td>${item.Category || 'Uncategorized'}</td>
                <td><strong style="color: ${stockColor}">${item.Stock || 0}</strong></td>
                <td>Rs ${parseFloat(item.Price) || 0}</td>
                <td>${stockStatus}</td>
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
        
        if (!name || !sku || !priceInput || stockInput === "") {
            UI.showToast("Please fill in required fields (Name, SKU, Stock, Price)", "error");
            return;
        }
        
        const stock = parseInt(stockInput) || 0;
        const price = parseFloat(priceInput) || 0;
        
        if (price < 0 || stock < 0) {
            UI.showToast("Price and Stock must be positive values", "error");
            return;
        }
        
        try {
            await API.request("addInventoryItem", {
                name,
                sku,
                category,
                stock,
                price
            });
            UI.showToast("Product added successfully!");
            UI.closeModal('inventoryModal');
            document.getElementById('inventoryForm').reset();
            this.load();
        } catch (e) {
            UI.showToast("Failed to add product: " + e.message, "error");
            console.error("Inventory add error:", e);
        }
    }
};