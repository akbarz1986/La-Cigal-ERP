// Add this at the very top of your api/request.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const { action, payload, user, gasUrl } = req.body;
    
    // Forward the request to your Google Apps Script URL
    const response = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload, user })
    });
    
    const data = await response.json();
    return res.status(200).json(data);
}


const API = {
    async request(action, payload = {}) {
        try {
            const user = Auth.currentUser ? Auth.currentUser.Name : "System";
            const response = await fetch("/api/request", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ 
                    action, 
                    payload, 
                    user,
                    gasUrl: CONFIG.GAS_WEB_APP_URL
                })
            });
            
            const result = await response.json();
            if (result.status === "success") {
                let data = result.data;
                // Centralized client-side self-healing for settings data
                if (action === "getSettings" && Array.isArray(data)) {
                    const settingsObj = {};
                    data.forEach(item => {
                        const key = item.Key || item.key;
                        const val = item.Value !== undefined ? item.Value : item.value;
                        if (key) {
                            settingsObj[key] = val;
                        }
                    });
                    data = settingsObj;
                }
                // Centralized client-side self-healing for inventory data
                if (action === "getInventory" && Array.isArray(data)) {
                    const skuCounts = {};
                    data.forEach(item => {
                        if (item.SKU) {
                            skuCounts[item.SKU] = (skuCounts[item.SKU] || 0) + 1;
                        }
                    });
                    
                    data = data.map(item => {
                        let sku = item.SKU || '';
                        let stock = parseInt(item.Stock) || 0;
                        
                        // If SKU is numeric and is either duplicated or stock is 0 (classic user SKU=Stock column shift)
                        if ((sku === '10' || !isNaN(sku)) && (skuCounts[sku] > 1 || stock === 0)) {
                            // Move numeric value to Stock if Stock is 0
                            if (stock === 0 && !isNaN(sku) && parseInt(sku) > 0) {
                                item.Stock = parseInt(sku);
                                item.CurrentStock = parseInt(sku);
                            }
                            
                            // Re-generate unique SKU from product name
                            const name = item.Name || '';
                            let cleanSku = name.toUpperCase().replace(/[^A-Z0-9]/g, "-").replace(/-+/g, "-");
                            if (cleanSku.endsWith("-")) cleanSku = cleanSku.slice(0, -1);
                            if (cleanSku.startsWith("-")) cleanSku = cleanSku.slice(1);
                            if (!cleanSku) cleanSku = "PROD-" + Math.floor(1000 + Math.random() * 9000);
                            
                            item.SKU = cleanSku;
                            item.ProductID = cleanSku;
                        }
                        return item;
                    });
                }
                return data;
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
