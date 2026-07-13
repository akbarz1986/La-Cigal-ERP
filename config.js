const CONFIG = {
    // Backend API endpoint
    // Replace with your Google Apps Script deployment URL
    GAS_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbx4xriiUE01x0fGvfjYC3CBftLu8fyGMKgW-cF1ZiCenCtvaeLfM4z5bF7OhW0KvV7zbQ/exec",
    
    // App Settings
    APP_NAME: "La Cigal ERP",
    VERSION: "1.0.0",
    
    // Pagination
    ITEMS_PER_PAGE: 20,
    
    // Cache duration (in minutes)
    CACHE_DURATION: 30
};

/**
 * Returns today's date formatted as YYYY-MM-DD in Asia/Karachi (Islamabad/Pakistan) timezone
 */
function getIslamabadDate() {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}

// Validate configuration on load
document.addEventListener('DOMContentLoaded', () => {
    if (CONFIG.GAS_WEB_APP_URL.includes('YOUR_DEPLOYMENT_ID')) {
        console.warn('⚠️ GAS_WEB_APP_URL not configured. Please update config.js with your deployment URL.');
    }
});