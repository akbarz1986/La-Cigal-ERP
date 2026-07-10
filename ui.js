const UI = {
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
    },

    switchView(targetId) {
        document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
        document.querySelectorAll('.nav-btn[data-target]').forEach(btn => btn.classList.remove('active'));
        
        const targetView = document.getElementById(`view-${targetId}`);
        const targetBtn = document.querySelector(`.nav-btn[data-target="${targetId}"]`);
        
        if (targetView) targetView.classList.add('active');
        if (targetBtn) targetBtn.classList.add('active');
        
        // Mobile sidebar close on click
        document.getElementById('sidebar').classList.remove('open');
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
        document.getElementById(modalId).classList.add('active');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
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
        // Hide elements that don't match the role
        document.querySelectorAll('[data-role]').forEach(el => {
            const allowedRoles = el.getAttribute('data-role').split(',');
            if (!allowedRoles.includes(role)) {
                el.style.display = 'none';
            } else {
                el.style.display = '';
            }
        });
    }
};

// Setup Navigation
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-btn[data-target]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            UI.switchView(e.currentTarget.getAttribute('data-target'));
        });
    });
    UI.initTheme();
});
