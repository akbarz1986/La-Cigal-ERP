const Settings = {
    users: [],
    settings: {},

    async load() {
        try {
            [this.users, this.settings] = await Promise.all([
                API.request("getUsers"),
                API.request("getSettings")
            ]);
            this.render();
        } catch (e) {
            console.error("Failed to load settings", e);
            UI.showToast("Failed to load settings", "error");
        }
    },

    render() {
        this.renderUsers();
        this.renderSettings();
    },

    renderUsers() {
        const container = document.getElementById('usersList');
        if (!container) return;

        if (this.users.length === 0) {
            container.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:20px;">No users found.</div>`;
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                    ${this.users.map(u => `
                        <tr>
                            <td><strong>${u.Name}</strong></td>
                            <td><span class="badge badge-info">${u.Role}</span></td>
                            <td>${u.Email || '-'}</td>
                            <td><span class="badge ${u.Status === 'Active' ? 'badge-success' : 'badge-danger'}">${u.Status}</span></td>
                            <td>
                                <button class="btn btn-outline" style="padding:5px 10px;font-size:0.8rem;" 
                                    onclick="Settings.toggleUserStatus('${u.UserID}','${u.Status}')">
                                    ${u.Status === 'Active' ? 'Deactivate' : 'Activate'}
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
    },

    renderSettings() {
        const container = document.getElementById('settingsForm');
        if (!container) return;

        const taxRate = this.settings['TaxRate'] || '0';
        const businessName = this.settings['BusinessName'] || 'La Cigal Salon & Spa';
        const currency = this.settings['Currency'] || 'Rs';
        const loyaltyRate = this.settings['LoyaltyPointsPerRs'] || '100';

        container.innerHTML = `
            <div class="form-group">
                <label>Business Name</label>
                <input type="text" id="settingBusinessName" value="${businessName}">
            </div>
            <div class="form-group">
                <label>Currency Symbol</label>
                <input type="text" id="settingCurrency" value="${currency}">
            </div>
            <div class="form-group">
                <label>Tax Rate (%)</label>
                <input type="number" id="settingTaxRate" value="${taxRate}" min="0" max="100" step="0.5">
            </div>
            <div class="form-group">
                <label>Loyalty Points: 1 point per Rs</label>
                <input type="number" id="settingLoyaltyRate" value="${loyaltyRate}" min="1">
            </div>
            <button class="btn btn-primary" onclick="Settings.saveSettings()">
                <i class="fas fa-save"></i> Save Settings
            </button>`;
    },

    async saveSettings() {
        const updates = [
            { key: 'BusinessName', value: document.getElementById('settingBusinessName')?.value },
            { key: 'Currency', value: document.getElementById('settingCurrency')?.value },
            { key: 'TaxRate', value: document.getElementById('settingTaxRate')?.value },
            { key: 'LoyaltyPointsPerRs', value: document.getElementById('settingLoyaltyRate')?.value }
        ];

        try {
            await Promise.all(updates.map(u => API.request("updateSetting", u)));
            UI.showToast("Settings saved successfully!");
            this.load();
        } catch (e) {
            UI.showToast("Failed to save settings: " + e.message, "error");
        }
    },

    async saveUser() {
        const name = document.getElementById('newUserName')?.value;
        const role = document.getElementById('newUserRole')?.value;
        const pin = document.getElementById('newUserPIN')?.value;
        const email = document.getElementById('newUserEmail')?.value;

        if (!name || !role || !pin) {
            UI.showToast("Name, Role, and PIN are required", "error");
            return;
        }

        if (pin.length !== 4 || isNaN(pin)) {
            UI.showToast("PIN must be exactly 4 digits", "error");
            return;
        }

        try {
            await API.request("addUser", { name, role, pin, email });
            UI.showToast("User " + name + " added successfully!");
            UI.closeModal('addUserModal');
            document.getElementById('addUserForm').reset();
            this.load();
        } catch (e) {
            UI.showToast("Failed to add user: " + e.message, "error");
        }
    },

    async toggleUserStatus(userID, currentStatus) {
        const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
        try {
            await API.request("updateUser", { userID, status: newStatus });
            UI.showToast("User status updated to " + newStatus);
            this.load();
        } catch (e) {
            UI.showToast("Failed to update user: " + e.message, "error");
        }
    }
};
