const Inventory = {
    data: [],

    async load() {
        // Placeholders. We would query "getInventory" from API.gs
        const tbody = document.querySelector('#inventoryTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr>
                <td>Gold Facial Kit</td>
                <td>SKU-1001</td>
                <td>Retail</td>
                <td><strong style="color: var(--success)">45</strong></td>
                <td>Rs 1500</td>
                <td>Active</td>
            </tr>
            <tr>
                <td>L'Oreal Shampoo 500ml</td>
                <td>SKU-1002</td>
                <td>Salon Use</td>
                <td><strong style="color: var(--danger)">2</strong></td>
                <td>Rs 800</td>
                <td>Low Stock</td>
            </tr>
        `;
    }
};
