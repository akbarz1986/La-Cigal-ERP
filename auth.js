const Auth = {
    currentPin: "",
    currentUser: null,

    enterPin(num) {
        if (this.currentPin.length < 4) {
            this.currentPin += num;
            this.updatePinDisplay();
        }
    },

    clearPin() {
        this.currentPin = "";
        this.updatePinDisplay();
    },

    updatePinDisplay() {
        document.getElementById('pinDisplay').textContent = this.currentPin.padEnd(4, '•').substring(0, 4);
    },

    async submitPin() {
        if (this.currentPin.length !== 4) return;
        
        const pinDisplay = document.getElementById('pinDisplay');
        const loginError = document.getElementById('loginError');
        
        pinDisplay.textContent = "WAIT";
        loginError.textContent = "";
        
        try {
            const user = await API.request("authenticate", { pin: this.currentPin });
            await this.loginSuccess(user);
        } catch (error) {
            loginError.textContent = error.message || "Invalid PIN";
            this.clearPin();
        }
    },

    async loginSuccess(user) {
        this.currentUser = user;
        document.getElementById('currentUser').textContent = user.Name;
        
        // Apply Role Based Permissions
        await UI.applyRolePermissions(user.Role);
        
        document.getElementById('loginOverlay').classList.remove('active');
        document.getElementById('appShell').classList.remove('hidden');
        
        // Initialize App Data
        App.init();
    },

    logout() {
        this.currentUser = null;
        this.clearPin();
        
        // Clear application state
        if (typeof POS !== 'undefined' && POS.clear) {
            POS.clear();
        }
        if (typeof UI !== 'undefined') {
            UI.switchView('pos'); // Reset to default view
        }
        
        document.getElementById('loginOverlay').classList.add('active');
        document.getElementById('appShell').classList.add('hidden');
    }
};
