const Bookings = {
    data: [],

    async load() {
        try {
            this.data = await API.request("getAppointments");
            this.render();
        } catch (e) {
            console.error("Failed to load bookings", e);
        }
    },

    render() {
        const list = document.getElementById('appointmentList');
        if (!list) return;
        
        list.innerHTML = "";
        
        if (this.data.length === 0) {
            list.innerHTML = "<div style='color: var(--text-muted)'>No appointments found.</div>";
            return;
        }
        
        this.data.forEach(appt => {
            if(!appt.ApptID) return;
            const statusClass = appt.Status === "Confirmed" ? "color: var(--success);" : "color: var(--primary-gold);";
            
            const card = document.createElement('div');
            card.style.cssText = "background: var(--surface-color); padding: 15px; border-radius: 12px; margin-bottom: 15px; border: 1px solid var(--border-color); display: flex; align-items: center; gap: 20px;";
            
            card.innerHTML = `
                <div style="font-size: 1.2rem; font-weight: bold; width: 80px; text-align: right;">
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
    }
};
