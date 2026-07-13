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
        this.renderPermissions();
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

    renderPermissions() {
        const container = document.getElementById('permissionsForm');
        if (!container) return;

        const defaultManagerFeatures = "pos,dashboard,bookings,customers,inventory,packages,suppliers,expenses,credits,refunds,reports";
        const defaultStaffFeatures = "pos,bookings,customers,packages,credits";

        const managerFeatures = this.settings['AllowedFeatures_Manager'] !== undefined ? this.settings['AllowedFeatures_Manager'] : defaultManagerFeatures;
        const staffFeatures = this.settings['AllowedFeatures_Staff'] !== undefined ? this.settings['AllowedFeatures_Staff'] : defaultStaffFeatures;

        const managerList = managerFeatures.split(',').map(f => f.trim().toLowerCase());
        const staffList = staffFeatures.split(',').map(f => f.trim().toLowerCase());

        const features = [
            { id: 'pos', name: 'Point of Sale (POS)', icon: 'fa-cash-register' },
            { id: 'dashboard', name: 'Dashboard', icon: 'fa-chart-pie' },
            { id: 'bookings', name: 'Bookings', icon: 'fa-calendar-alt' },
            { id: 'customers', name: 'Customers', icon: 'fa-users' },
            { id: 'inventory', name: 'Inventory', icon: 'fa-boxes' },
            { id: 'packages', name: 'Packages', icon: 'fa-box-open' },
            { id: 'suppliers', name: 'Suppliers', icon: 'fa-truck' },
            { id: 'expenses', name: 'Expenses', icon: 'fa-receipt' },
            { id: 'credits', name: 'Credits', icon: 'fa-credit-card' },
            { id: 'refunds', name: 'Refunds', icon: 'fa-undo' },
            { id: 'reports', name: 'Reports', icon: 'fa-chart-line' },
            { id: 'settings', name: 'Settings', icon: 'fa-cog' }
        ];

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; width: 100%;">
                <!-- Manager Permissions Card -->
                <div style="background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; box-shadow: var(--shadow);">
                    <h4 style="margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; color: var(--primary-gold); font-size: 1.05rem; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-user-tie"></i> Manager Role Features
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${features.map(f => `
                            <label style="display: flex; align-items: center; gap: 10px; font-weight: 500; cursor: pointer; color: var(--text-primary); font-size: 0.9rem;">
                                <input type="checkbox" class="manager-feature-chk" value="${f.id}" ${managerList.includes(f.id) ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary-gold); cursor: pointer;">
                                <span style="display: flex; align-items: center; gap: 8px;"><i class="fas ${f.icon}" style="color: var(--primary-gold); width: 16px;"></i> ${f.name}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <!-- Staff Permissions Card -->
                <div style="background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; box-shadow: var(--shadow);">
                    <h4 style="margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; color: var(--primary-gold); font-size: 1.05rem; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-user"></i> Staff Role Features
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${features.map(f => `
                            <label style="display: flex; align-items: center; gap: 10px; font-weight: 500; cursor: pointer; color: var(--text-primary); font-size: 0.9rem;">
                                <input type="checkbox" class="staff-feature-chk" value="${f.id}" ${staffList.includes(f.id) ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary-gold); cursor: pointer;">
                                <span style="display: flex; align-items: center; gap: 8px;"><i class="fas ${f.icon}" style="color: var(--primary-gold); width: 16px;"></i> ${f.name}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="Settings.savePermissions()">
                    <i class="fas fa-save"></i> Save Permissions
                </button>
            </div>
        `;
    },

    async savePermissions() {
        const managerCheckboxes = document.querySelectorAll('.manager-feature-chk:checked');
        const staffCheckboxes = document.querySelectorAll('.staff-feature-chk:checked');

        const managerFeatures = Array.from(managerCheckboxes).map(cb => cb.value).join(',');
        const staffFeatures = Array.from(staffCheckboxes).map(cb => cb.value).join(',');

        const updates = [
            { key: 'AllowedFeatures_Manager', value: managerFeatures },
            { key: 'AllowedFeatures_Staff', value: staffFeatures }
        ];

        try {
            await Promise.all(updates.map(u => API.request("updateSetting", u)));
            UI.showToast("Permissions saved successfully!");
            
            // Re-apply for currently logged in user immediately if they are affected
            if (Auth.currentUser) {
                const settingsList = await API.request("getSettings") || {};
                await UI.applyRolePermissions(Auth.currentUser.Role, settingsList);
            }
            
            this.load();
        } catch (e) {
            UI.showToast("Failed to save permissions: " + e.message, "error");
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
