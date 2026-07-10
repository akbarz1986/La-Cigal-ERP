const API = {
    async request(action, payload = {}) {
        try {
            const user = Auth.currentUser ? Auth.currentUser.Name : "System";
            const response = await fetch(CONFIG.GAS_WEB_APP_URL, {
                method: "POST",
                body: JSON.stringify({ action, payload, user })
            });
            
            const result = await response.json();
            if (result.status === "success") {
                return result.data;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error("API Error:", error);
            UI.showToast("Network Error: " + error.message, "error");
            throw error;
        }
    }
};
