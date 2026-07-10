const Customers = {
    data: [],
    filteredData: [],

    async load() {
        try {
            this.data = await API.request("getCustomers");
            this.filteredData = [...this.data];
            this.render();
        } catch (e) {
            console.error("Failed to load customers", e);
            UI.showToast("Failed to load customers", "error");
        }
    },

    filter(searchTerm) {
        if (!searchTerm.trim()) {
            this.filteredData = [...this.data];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredData = this.data.filter(cust =>
                (cust.Name && cust.Name.toLowerCase().includes(term)) ||
                (cust.Phone && cust.Phone.includes(term))
            );
        }
        this.render();
    },

    render() {
        const grid = document.getElementById('customerGrid');
        if (!grid) return;

        grid.innerHTML = "";
        if (this.filteredData.length === 0) {
            grid.innerHTML = `<div style='grid-column:1/-1;color:var(--text-muted);text-align:center;padding:30px;'>No customers found.</div>`;
            return;
        }

        const today = new Date();
        const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        this.filteredData.forEach(cust => {
            if (!cust.CustomerID) return;

            // Check birthday/anniversary
            let birthdayBadge = '';
            let anniversaryBadge = '';
            if (cust.Birthday) {
                try {
                    const bday = new Date(cust.Birthday);
                    const bdayMMDD = `${String(bday.getMonth() + 1).padStart(2, '0')}-${String(bday.getDate()).padStart(2, '0')}`;
                    if (bdayMMDD === todayMMDD) birthdayBadge = `<span class="badge badge-gold" title="Birthday today!"><i class="fas fa-birthday-cake"></i> Birthday!</span>`;
                } catch (e) {}
            }
            if (cust.Anniversary) {
                try {
                    const ann = new Date(cust.Anniversary);
                    const annMMDD = `${String(ann.getMonth() + 1).padStart(2, '0')}-${String(ann.getDate()).padStart(2, '0')}`;
                    if (annMMDD === todayMMDD) anniversaryBadge = `<span class="badge badge-gold" title="Anniversary today!"><i class="fas fa-heart"></i> Anniversary!</span>`;
                } catch (e) {}
            }

            const card = document.createElement('div');
            card.className = "service-btn";
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <h4>${cust.Name || 'Unknown'}</h4>
                    <span style="background:var(--primary-gold);color:#fff;padding:3px 8px;border-radius:10px;font-size:0.8rem;">
                        <i class="fas fa-star"></i> ${cust.LoyaltyPoints || 0}
                    </span>
                </div>
                ${birthdayBadge || anniversaryBadge ? `<div style="margin-top:5px;">${birthdayBadge}${anniversaryBadge}</div>` : ''}
                <div style="color:var(--text-muted);font-size:0.9rem;margin-top:10px;">
                    <p><i class="fas fa-phone"></i> ${cust.Phone || 'N/A'}</p>
                    <p><i class="fas fa-history"></i> Visits: ${cust.VisitCount || 0} | Spend: Rs ${parseFloat(cust.LifetimeSpend || 0).toLocaleString()}</p>
                    ${cust.Birthday ? `<p><i class="fas fa-birthday-cake"></i> ${new Date(cust.Birthday).toLocaleDateString()}</p>` : ''}
                </div>
            `;
            card.onclick = () => {
                POS.setCustomer(cust);
                UI.switchView('pos');
            };
            grid.appendChild(card);
        });
    },

    async save() {
        const name = document.getElementById('custName')?.value;
        const phone = document.getElementById('custPhone')?.value;
        const email = document.getElementById('custEmail')?.value;
        const whatsapp = document.getElementById('custWhatsApp')?.value;
        const birthday = document.getElementById('custBirthday')?.value;
        const anniversary = document.getElementById('custAnniversary')?.value;
        const notes = document.getElementById('custNotes')?.value;

        if (!name || !phone) {
            UI.showToast("Please fill name and phone", "error");
            return;
        }

        if (phone.length < 7) {
            UI.showToast("Phone number must be at least 7 digits", "error");
            return;
        }

        if (email && !this.validateEmail(email)) {
            UI.showToast("Please enter a valid email address", "error");
            return;
        }

        const duplicate = this.data.find(c => c.Phone === phone);
        if (duplicate) {
            UI.showToast("Customer with this phone number already exists", "error");
            return;
        }

        try {
            await API.request("addCustomer", { name, phone, email, whatsapp, birthday, anniversary, notes });
            UI.showToast("Customer added successfully!");
            UI.closeModal('customerModal');
            document.getElementById('customerForm').reset();
            this.load();
        } catch (e) {
            UI.showToast("Failed to add customer: " + e.message, "error");
        }
    },

    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('customerSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            Customers.filter(e.target.value);
        });
    }
});