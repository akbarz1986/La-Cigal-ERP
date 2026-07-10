const Customers = {
    data: [],

    async load() {
        try {
            this.data = await API.request("getCustomers");
            this.render();
        } catch (e) {
            console.error("Failed to load customers", e);
        }
    },

    render() {
        const grid = document.getElementById('customerGrid');
        if (!grid) return;
        
        grid.innerHTML = "";
        if (this.data.length === 0) {
            grid.innerHTML = "<div style='color: var(--text-muted)'>No customers found.</div>";
            return;
        }
        
        this.data.forEach(cust => {
            if(!cust.CustomerID) return;
            const card = document.createElement('div');
            card.className = "service-btn"; // Reusing the card style
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h4>${cust.Name}</h4>
                    <span style="background: var(--primary-gold); color: white; padding: 3px 8px; border-radius: 10px; font-size: 0.8rem;">
                        <i class="fas fa-star"></i> ${cust.LoyaltyPoints || 0}
                    </span>
                </div>
                <div style="color: var(--text-muted); font-size: 0.9rem; margin-top: 10px;">
                    <p><i class="fas fa-phone"></i> ${cust.Phone}</p>
                    <p><i class="fas fa-history"></i> Visits: ${cust.VisitCount || 0}</p>
                </div>
            `;
            card.onclick = () => {
                // Select customer for POS
                POS.setCustomer(cust);
                UI.switchView('pos');
            };
            grid.appendChild(card);
        });
    },
    
    async save() {
        const name = document.getElementById('custName').value;
        const phone = document.getElementById('custPhone').value;
        
        if(!name || !phone) {
            UI.showToast("Please fill name and phone", "error");
            return;
        }
        
        try {
            await API.request("addCustomer", { name, phone });
            UI.showToast("Customer added successfully!");
            UI.closeModal('customerModal');
            document.getElementById('customerForm').reset();
            this.load(); // reload list
        } catch (e) {
            UI.showToast("Failed to add customer", "error");
        }
    }
};
