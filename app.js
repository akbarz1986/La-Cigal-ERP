// Configuration
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx4xriiUE01x0fGvfjYC3CBftLu8fyGMKgW-cF1ZiCenCtvaeLfM4z5bF7OhW0KvV7zbQ/exec";

// State
let currentPin = "";
let currentUser = null;
let currentTicket = [];

// DOM Elements
const pinDisplay = document.getElementById('pinDisplay');
const loginOverlay = document.getElementById('loginOverlay');
const appShell = document.getElementById('appShell');
const serviceItems = document.getElementById('serviceItems');

// Login Logic
function enterPin(num) {
    if (currentPin.length < 4) {
        currentPin += num;
        updatePinDisplay();
    }
}

function clearPin() {
    currentPin = "";
    updatePinDisplay();
}

function updatePinDisplay() {
    pinDisplay.textContent = currentPin.padEnd(4, '•').substring(0, 4);
}

async function submitPin() {
    if(currentPin.length !== 4) return;
    
    // UI Loading state
    pinDisplay.textContent = "WAIT";
    
    try {
        // API Call to GAS
        const response = await fetch(GAS_WEB_APP_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "authenticate",
                payload: { pin: currentPin }
            })
        });
        
        const result = await response.json();
        
        if (result.status === "success") {
            currentUser = result.data;
            document.getElementById('currentUser').textContent = currentUser.Name;
            
            // Transition to App
            loginOverlay.classList.remove('active');
            appShell.classList.remove('hidden');
            
            // Load initial data
            loadDummyServices(); // Replace with actual API call in production
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        document.getElementById('loginError').textContent = "Invalid PIN. Try 1234";
        clearPin();
    }
}

// Temporary function to show luxurious UI without waiting for GAS response
function loadDummyServices() {
    const dummyServices = [
        { Name: "Signature Blowout", Price: "Rs 2500" },
        { Name: "Balayage Color", Price: "Rs 15000" },
        { Name: "Keratin Treatment", Price: "Rs 12000" },
        { Name: "Root Touch-up", Price: "Rs 3500" },
        { Name: "Hair Spa", Price: "Rs 4000" }
    ];
    
    serviceItems.innerHTML = "";
    dummyServices.forEach(srv => {
        const btn = document.createElement('button');
        btn.className = 'service-btn';
        btn.innerHTML = `<h4>${srv.Name}</h4><p>${srv.Price}</p>`;
        btn.onclick = () => addToTicket(srv);
        serviceItems.appendChild(btn);
    });
}

function addToTicket(service) {
    currentTicket.push(service);
    renderTicket();
}

function renderTicket() {
    const ticketDiv = document.getElementById('ticketItems');
    if(currentTicket.length === 0) {
        ticketDiv.innerHTML = '<div class="empty-ticket">Select a service to start</div>';
        return;
    }
    
    ticketDiv.innerHTML = "";
    let total = 0;
    
    currentTicket.forEach((item, index) => {
        const priceNum = parseInt(item.Price.replace('Rs ', ''));
        total += priceNum;
        
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.padding = '10px 0';
        row.style.borderBottom = '1px solid #eaeaea';
        
        row.innerHTML = `
            <span>${item.Name}</span>
            <span>${item.Price}</span>
        `;
        ticketDiv.appendChild(row);
    });
    
    // Update summary
    document.querySelector('.summary-row.total span:last-child').textContent = `Rs ${total}`;
}

// ==========================================
// NAVIGATION & TAB SWITCHING LOGIC
// ==========================================

const navButtons = document.querySelectorAll('.nav-btn[data-target]');
const viewSections = document.querySelectorAll('.view-section');

navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // 1. Remove the gold 'active' styling from all buttons
        navButtons.forEach(b => b.classList.remove('active'));
        
        // 2. Add 'active' styling to the clicked button
        const clickedBtn = e.currentTarget;
        clickedBtn.classList.add('active');
        
        // 3. Hide all main content views
        viewSections.forEach(view => view.classList.add('hidden'));
        
        // 4. Show the specific view that matches the button's data-target
        const targetId = clickedBtn.getAttribute('data-target');
        const targetView = document.getElementById(`view-${targetId}`);
        
        if (targetView) {
            targetView.classList.remove('hidden');
        }
    });
});
