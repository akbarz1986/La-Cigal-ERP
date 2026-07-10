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
    
    applyRolePermissions(role) {
        document.querySelectorAll('[data-role]').forEach(el => {
            const allowedRoles = el.getAttribute('data-role').split(',').map(r => r.trim());
            if (!allowedRoles.includes(role)) {
                el.style.display = 'none';
            } else {
                el.style.display = '';
            }
        });
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