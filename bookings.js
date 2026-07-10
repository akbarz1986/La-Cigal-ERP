const Bookings = {
    data: [],
    filteredData: [],

    async load() {
        try {
            this.data = await API.request("getAppointments");
            this.filteredData = [...this.data];
            this.render();
        } catch (e) {
            console.error("Failed to load bookings", e);
            UI.showToast("Failed to load bookings", "error");
        }
    },

    filter(dateString) {
        if (!dateString) {
            this.filteredData = [...this.data];
        } else {
            const filterDate = dateString;
            this.filteredData = this.data.filter(appt => {
                const apptDate = appt.Date ? appt.Date.substring(0, 10) : '';
                return apptDate === filterDate;
            });
        }
        this.render();
    },

    render() {
        const list = document.getElementById('appointmentList');
        if (!list) {
            console.warn("Appointment list not found");
            return;
        }
        
        list.innerHTML = "";
        
        if (this.filteredData.length === 0) {
            list.innerHTML = "<div style='color: var(--text-muted); text-align: center; padding: 30px;'>No appointments found.</div>";
            return;
        }
        
        this.filteredData.forEach(appt => {
            if(!appt.ApptID) return;
            const statusClass = appt.Status === "Confirmed" ? "color: var(--success);" : "color: var(--primary-gold);";
            
            const card = document.createElement('div');
            card.style.cssText = "background: var(--surface-color); padding: 15px; border-radius: 12px; margin-bottom: 15px; border: 1px solid var(--border-color); display: flex; align-items: center;";
            
            card.innerHTML = `
                <div style="font-size: 1.2rem; font-weight: bold; width: 80px; text-align: right; margin-right: 20px;">
                    ${appt.Time || "12:00"}
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 1.1rem; font-weight: bold; margin-bottom: 5px;">${appt.CustomerName || "Unknown"}</div>
                    <div style="color: var(--text-muted); font-size: 0.9rem;">
                        <i class="fas fa-spa"></i> ${appt.Services || "General"} &nbsp;|&nbsp; 
                        <i class="fas fa-user"></i> Staff: ${appt.Staff || "Any"}
                    </div>
                </div>
                <div style="font-weight: bold; ${statusClass}">
                    ${appt.Status || "Pending"}
                </div>
            `;
            list.appendChild(card);
        });
    },

    async save() {
        const customerName = document.getElementById('bookingCustomer')?.value;
        const date = document.getElementById('bookingDate')?.value;
        const time = document.getElementById('bookingTime')?.value;
        const services = document.getElementById('bookingService')?.value;
        
        if (!customerName || !date || !time) {
            UI.showToast("Please fill all required fields", "error");
            return;
        }
        
        const payload = {
            customerName,
            date,
            time,
            services: services || "General",
            phone: "",
            staff: "Any",
            duration: 60
        };
        
        try {
            await API.request("createBooking", payload);
            UI.showToast("Booking created successfully!");
            UI.closeModal('bookingModal');
            document.getElementById('bookingForm').reset();
            this.load();
        } catch (e) {
            UI.showToast("Failed to create booking: " + e.message, "error");
            console.error("Booking add error:", e);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const dateFilter = document.getElementById('bookingDateFilter');
    if (dateFilter) {
        dateFilter.addEventListener('change', (e) => {
            Bookings.filter(e.target.value);
        });
    }
});