const UI = {
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open');
        }
    },

    switchView(targetId) {
        const views = document.querySelectorAll('.view-section');
        const btns = document.querySelectorAll('.nav-btn[data-target]');
        
        views.forEach(view => view.classList.remove('active'));
        btns.forEach(btn => btn.classList.remove('active'));
        
        const targetView = document.getElementById(`view-${targetId}`);
        const targetBtn = document.querySelector(`.nav-btn[data-target="${targetId}"]`);
        
        if (targetView) targetView.classList.add('active');
        if (targetBtn) targetBtn.classList.add('active');
        
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.remove('open');
        }

        if (targetId === 'dashboard' && typeof Dashboard !== 'undefined') {
            Dashboard.load();
        } else if (targetId === 'bookings' && typeof Bookings !== 'undefined') {
            Bookings.load();
        } else if (targetId === 'customers' && typeof Customers !== 'undefined') {
            Customers.load();
        } else if (targetId === 'inventory' && typeof Inventory !== 'undefined') {
            Inventory.load();
        } else if (targetId === 'reports' && typeof Reports !== 'undefined') {
            Reports.load();
        } else if (targetId === 'expenses' && typeof Expenses !== 'undefined') {
            Expenses.load();
        } else if (targetId === 'suppliers' && typeof Suppliers !== 'undefined') {
            Suppliers.load();
        } else if (targetId === 'credits' && typeof Credits !== 'undefined') {
            Credits.load();
        } else if (targetId === 'refunds' && typeof Refunds !== 'undefined') {
            Refunds.load();
        } else if (targetId === 'settings' && typeof Settings !== 'undefined') {
            Settings.load();
        } else if (targetId === 'packages' && typeof Packages !== 'undefined') {
            Packages.load();
        }
    },

    toggleTheme() {
        const body = document.body;
        if (body.classList.contains('light-mode')) {
            body.classList.replace('light-mode', 'dark-mode');
            localStorage.setItem('theme', 'dark-mode');
        } else {
            body.classList.replace('dark-mode', 'light-mode');
            localStorage.setItem('theme', 'light-mode');
        }
    },

    initTheme() {
        const theme = localStorage.getItem('theme') || 'light-mode';
        document.body.className = theme;
    },

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        } else {
            console.warn(`Modal with ID "${modalId}" not found`);
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) {
            console.warn('Toast container not found');
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    async applyRolePermissions(role, settingsObj = null) {
        if (!settingsObj) {
            try {
                settingsObj = await API.request("getSettings") || {};
            } catch (e) {
                console.error("Failed to load settings in applyRolePermissions", e);
                settingsObj = {};
            }
        }

        const isSuperUser = (role === 'CEO' || role === 'Admin');

        // Defaults if not set
        const defaultManagerFeatures = "pos,dashboard,bookings,customers,inventory,packages,suppliers,expenses,credits,refunds,reports";
        const defaultStaffFeatures = "pos,bookings,customers,packages,credits";

        let allowedFeaturesStr = "";
        if (isSuperUser) {
            allowedFeaturesStr = "pos,dashboard,bookings,customers,inventory,packages,suppliers,expenses,credits,refunds,reports,settings";
        } else if (role === 'Manager') {
            allowedFeaturesStr = settingsObj['AllowedFeatures_Manager'] !== undefined ? settingsObj['AllowedFeatures_Manager'] : defaultManagerFeatures;
        } else if (role === 'Staff') {
            allowedFeaturesStr = settingsObj['AllowedFeatures_Staff'] !== undefined ? settingsObj['AllowedFeatures_Staff'] : defaultStaffFeatures;
        } else {
            const customKey = `AllowedFeatures_${role}`;
            allowedFeaturesStr = settingsObj[customKey] !== undefined ? settingsObj[customKey] : defaultStaffFeatures;
        }

        const allowedFeatures = allowedFeaturesStr.split(',').map(f => f.trim().toLowerCase());

        const btns = document.querySelectorAll('.nav-btn[data-target]');
        let firstVisibleTarget = "";

        btns.forEach(btn => {
            const targetId = btn.getAttribute('data-target');
            if (!targetId) return;

            const isAllowed = isSuperUser || allowedFeatures.includes(targetId.toLowerCase());
            if (isAllowed) {
                btn.style.display = '';
                if (!firstVisibleTarget) {
                    firstVisibleTarget = targetId;
                }
            } else {
                btn.style.display = 'none';
            }
        });

        // Also check elements with [data-role] as fallback
        document.querySelectorAll('[data-role]').forEach(el => {
            // If it's a sidebar nav-btn, we already handled it
            if (el.classList.contains('nav-btn')) return;
            const allowedRoles = el.getAttribute('data-role').split(',').map(r => r.trim());
            if (!allowedRoles.includes(role)) {
                el.style.display = 'none';
            } else {
                el.style.display = '';
            }
        });

        // If the current active view button is hidden, switch to the first visible view
        const activeBtn = document.querySelector('.nav-btn.active');
        if (activeBtn && activeBtn.style.display === 'none') {
            if (firstVisibleTarget) {
                this.switchView(firstVisibleTarget);
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-btn[data-target]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.getAttribute('data-target');
            UI.switchView(target);
        });
    });
    UI.initTheme();
});

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});