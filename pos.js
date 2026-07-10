const POS = {
    services: [],
    currentTicket: [],
    selectedCustomer: null,

    async loadServices() {
        try {
            this.services = await API.request("getServices");
            this.renderServices();
        } catch (e) {
            console.error("Failed to load services", e);
        }
    },

    renderServices() {
        const container = document.getElementById('serviceItems');
        if (!container) return;
        
        container.innerHTML = "";
        
        if (this.services.length === 0) {
            container.innerHTML = "<div style='grid-column: 1/-1; color: var(--text-muted);'>No services found. Please add them in the database.</div>";
            return;
        }

        this.services.forEach(srv => {
            if (srv.Status !== "Active") return;
            
            const btn = document.createElement('button');
            btn.className = 'service-btn';
            btn.innerHTML = `
                <h4>${srv.Name}</h4>
                <p>Rs ${srv.Price}</p>
            `;
            btn.onclick = () => this.addToTicket(srv);
            container.appendChild(btn);
        });
    },

    setCustomer(customer) {
        this.selectedCustomer = customer;
        document.getElementById('ticketCustomer').innerHTML = `<p><strong>${customer.Name}</strong> <br><small>${customer.Phone}</small></p>`;
        UI.showToast(`Selected customer: ${customer.Name}`);
    },

    addToTicket(service) {
        this.currentTicket.push({
            ...service,
            uid: Date.now() + Math.random()
        });
        this.renderTicket();
    },
    
    removeFromTicket(uid) {
        this.currentTicket = this.currentTicket.filter(item => item.uid !== uid);
        this.renderTicket();
    },

    renderTicket() {
        const ticketDiv = document.getElementById('ticketItems');
        
        if (this.currentTicket.length === 0) {
            ticketDiv.innerHTML = '<div class="empty-ticket">Select a service to start</div>';
            this.updateTotals(0);
            return;
        }
        
        ticketDiv.innerHTML = "";
        let total = 0;
        
        this.currentTicket.forEach(item => {
            const price = parseFloat(item.Price) || 0;
            total += price;
            
            const row = document.createElement('div');
            row.className = 'ticket-row';
            row.innerHTML = `
                <div>
                    <strong>${item.Name}</strong><br>
                    <small style="color: var(--text-muted)">Staff: None</small>
                </div>
                <div style="display: flex; gap: 15px; align-items: center;">
                    <span>Rs ${price}</span>
                    <button class="remove-item" onclick="POS.removeFromTicket(${item.uid})"><i class="fas fa-times"></i></button>
                </div>
            `;
            ticketDiv.appendChild(row);
        });
        
        this.updateTotals(total);
    },
    
    updateTotals(total) {
        document.getElementById('posSubtotal').textContent = `Rs ${total}`;
        document.getElementById('posTotal').textContent = `Rs ${total}`;
        document.getElementById('amountReceived').value = total;
    },
    
    openCheckout() {
        if(this.currentTicket.length === 0) {
            UI.showToast("Ticket is empty!", "error");
            return;
        }
        UI.openModal('checkoutModal');
    },

    async finalizePayment() {
        const totalText = document.getElementById('posTotal').textContent.replace('Rs ', '');
        const total = parseFloat(totalText);
        const amountReceived = parseFloat(document.getElementById('amountReceived').value);
        
        if(amountReceived < total) {
            UI.showToast("Amount received is less than total!", "error");
            return;
        }
        
        const selectedPM = document.querySelector('.pm-card.active');
        const paymentMethod = selectedPM ? selectedPM.getAttribute('data-method') : 'Cash';
        
        const payload = {
            customerID: this.selectedCustomer ? this.selectedCustomer.CustomerID : "Walk-in",
            subtotal: total,
            total: total,
            paymentMethod: paymentMethod,
            items: this.currentTicket
        };

        try {
            const result = await API.request("processPayment", payload);
            UI.showToast("Payment Successful! Invoice: " + result.invoiceNumber);
            
            // Clear POS
            this.currentTicket = [];
            this.selectedCustomer = null;
            document.getElementById('ticketCustomer').innerHTML = `<p><strong>Walk-in Customer</strong></p>`;
            this.renderTicket();
            UI.closeModal('checkoutModal');
            
        } catch(err) {
            UI.showToast("Payment failed. Please try again.", "error");
        }
    }
};

// Payment Method selection logic
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.pm-card').forEach(card => {
        card.addEventListener('click', (e) => {
            document.querySelectorAll('.pm-card').forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });
});
