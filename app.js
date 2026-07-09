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

// ==========================================
// LOGIN LOGIC
// ==========================================
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
    pinDisplay.textContent = "WAIT";
    
    try {
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
            
            loginOverlay.classList.remove('active');
            appShell.classList.remove('hidden');
            
            loadDummyServices(); // Initial POS load
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        document.getElementById('loginError').textContent = "Invalid PIN. Try 1234";
        clearPin();
    }
}

// ==========================================
// POS LOGIC
// ==========================================
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
        
        row.innerHTML = `<span>${item.Name}</span><span>${item.Price}</span>`;
        ticketDiv.appendChild(row);
    });
    
    document.querySelector('.summary-row.total span:last-child').textContent = `Rs ${total}`;
}

// ==========================================
// CUSTOMERS & BOOKINGS LOGIC
// ==========================================
function loadDummyCustomers() {
    const clients = [
        { Name: "Aisha Khan", Phone: "0300-1234567", Visits: 12, Points: 450, LastVisit: "2 days ago" },
        { Name: "Fatima Ali", Phone: "0333-9876543", Visits: 3, Points: 120, LastVisit: "1 week ago" },
        { Name: "Zara Ahmed", Phone: "0321-5558888", Visits: 24, Points: 1250, LastVisit: "Today" }
    ];

    const grid = document.getElementById('customerGrid');
    if(!grid) return;
    
    grid.innerHTML = "";
    clients.forEach(client => {
        grid.innerHTML += `
            <div class="client-card">
                <div class="client-card-header">
                    <div class="client-name">${client.Name}</div>
                    <div class="client-badge"><i class="fas fa-star"></i> ${client.Points} pts</div>
                </div>
                <div style="color: var(--text-muted); font-size: 0.9rem;">
                    <p><i class="fas fa-phone-alt"></i> ${client.Phone}</p>
                    <p><i class="fas fa-history"></i> Last Visit: ${client.LastVisit}</p>
                    <p><i class="fas fa-spa"></i> Total Visits: ${client.Visits}</p>
                </div>
            </div>
        `;
    });
}

function loadDummyBookings() {
    const appts = [
        { Time: "10:00 AM", Client: "Sarah Tariq", Service: "Bridal Makeup Trial", Staff: "Maria", Status: "Confirmed" },
        { Time: "11:30 AM", Client: "Hira Usman", Service: "Keratin Treatment", Staff: "Sana", Status: "Pending" },
        { Time: "02:00 PM", Client: "Nida Shoaib", Service: "Signature Manicure & Pedicure", Staff: "Zainab", Status: "Confirmed" }
    ];

    const list = document.getElementById('appointmentList');
    if(!list) return;

    list.innerHTML = "";
    appts.forEach(appt => {
        const statusClass = appt.Status === "Confirmed" ? "status-confirmed" : "status-pending";
        list.innerHTML += `
            <div class="appt-card">
                <div class="appt-time">${appt.Time}</div>
                <div class="appt-details">
                    <div class="client-name" style="margin-bottom: 5px;">${appt.Client}</div>
                    <div style="color: var(--text-muted); font-size: 0.9rem;">
                        <i class="fas fa-spa"></i> ${appt.Service} &nbsp;|&nbsp; 
                        <i class="fas fa-user-nurse"></i> Staff: ${appt.Staff}
                    </div>
                </div>
                <div class="appt-status ${statusClass}">${appt.Status}</div>
            </div>
        `;
    });
}

// ==========================================
// NAVIGATION & TAB SWITCHING LOGIC
// ==========================================
const navButtons = document.querySelectorAll('.nav-btn[data-target]');
const viewSections = document.querySelectorAll('.view-section');

navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        navButtons.forEach(b => b.classList.remove('active'));
        const clickedBtn = e.currentTarget;
        clickedBtn.classList.add('active');
        
        viewSections.forEach(view => view.classList.add('hidden'));
        
        const targetId = clickedBtn.getAttribute('data-target');
        const targetView = document.getElementById(`view-${targetId}`);
        
        if (targetView) {
            targetView.classList.remove('hidden');
        }

        // TRIGGER DATA LOADS based on the tab clicked
        if (targetId === 'customers') loadDummyCustomers();
        if (targetId === 'bookings') loadDummyBookings();
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('bookingDateFilter');
    if(dateInput) dateInput.valueAsDate = new Date();
});
