const Bookings = {
    data: [],
    filteredData: [],
    currentYear: null,
    currentMonth: null,
    selectedDate: null,

    async load() {
        try {
            this.data = await API.request("getAppointments") || [];
            
            // Filter: Show all appointments from TODAY and onwards only (Islamabad Time)
            const todayStr = getIslamabadDate();
            this.filteredData = this.data.filter(appt => {
                if (!appt.Date) return false;
                const apptDate = appt.Date.substring(0, 10);
                return apptDate >= todayStr;
            });
            
            // Initialize calendar settings
            this.initCalendar();
            
            // Render all modules
            this.render();
        } catch (e) {
            console.error("Failed to load bookings", e);
            UI.showToast("Failed to load bookings", "error");
        }
    },

    initCalendar() {
        const todayStr = getIslamabadDate();
        const [year, month, day] = todayStr.split('-').map(Number);
        
        if (this.currentYear === null || this.currentYear === undefined) {
            this.currentYear = year;
            this.currentMonth = month - 1; // 0-indexed month
        }
        
        if (!this.selectedDate) {
            this.selectedDate = todayStr;
        }
    },

    jumpToDate(dateString) {
        if (!dateString) return;
        const [y, m, d] = dateString.split('-').map(Number);
        
        const todayStr = getIslamabadDate();
        if (dateString < todayStr) {
            UI.showToast("Cannot select past dates", "warning");
            return;
        }
        
        this.currentYear = y;
        this.currentMonth = m - 1;
        this.selectedDate = dateString;
        this.render();
    },

    prevMonth() {
        this.currentMonth--;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        this.renderCalendar();
    },

    nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.renderCalendar();
    },

    renderCalendar() {
        this.initCalendar();
        
        const monthYearEl = document.getElementById('calendarMonthYear');
        const daysGridEl = document.getElementById('calendarDaysGrid');
        if (!monthYearEl || !daysGridEl) return;
        
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        monthYearEl.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;
        
        daysGridEl.innerHTML = "";
        
        // Find first day of the month and number of days in the month
        const firstDayIndex = new Date(this.currentYear, this.currentMonth, 1).getDay(); // 0 is Sun
        const numDays = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        
        // Empty cells for alignment
        for (let i = 0; i < firstDayIndex; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = "calendar-day-cell empty-cell";
            daysGridEl.appendChild(emptyCell);
        }
        
        const todayStr = getIslamabadDate();
        
        // Draw each day of the month
        for (let day = 1; day <= numDays; day++) {
            const monthStr = String(this.currentMonth + 1).padStart(2, '0');
            const dayStr = String(day).padStart(2, '0');
            const dateStr = `${this.currentYear}-${monthStr}-${dayStr}`;
            
            const cell = document.createElement('div');
            cell.className = "calendar-day-cell";
            
            const isPast = dateStr < todayStr;
            if (isPast) {
                cell.classList.add("past-cell");
            }
            if (dateStr === todayStr) {
                cell.classList.add("today-cell");
            }
            if (dateStr === this.selectedDate) {
                cell.classList.add("active-day");
            }
            
            const dayAppts = this.filteredData.filter(appt => {
                const apptDate = appt.Date ? appt.Date.substring(0, 10) : '';
                return apptDate === dateStr;
            });
            
            let badgeHTML = "";
            if (dayAppts.length > 0) {
                badgeHTML = `<span class="appt-badge">${dayAppts.length}</span>`;
            }
            
            cell.innerHTML = `
                <span class="day-number">${day}</span>
                ${badgeHTML}
            `;
            
            cell.addEventListener('click', () => {
                if (isPast) {
                    UI.showToast("Cannot select past dates", "warning");
                    return;
                }
                this.selectedDate = dateStr;
                this.renderCalendar();
                this.renderSelectedDayAppointments();
            });
            
            daysGridEl.appendChild(cell);
        }
    },

    renderSelectedDayAppointments() {
        const listEl = document.getElementById('selectedDayList');
        const titleEl = document.getElementById('selectedDateTitle');
        if (!listEl) return;
        
        const todayStr = getIslamabadDate();
        if (!this.selectedDate) {
            this.selectedDate = todayStr;
        }
        
        // Format selected date nicely
        const [year, month, day] = this.selectedDate.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = dateObj.toLocaleDateString('en-US', options);
        
        if (titleEl) {
            titleEl.innerHTML = `
                <i class="far fa-calendar-check" style="color: var(--primary-gold);"></i>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">Appointments</span>
                    <small style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">${formattedDate}</small>
                </div>
            `;
        }
        
        const dayAppts = this.filteredData.filter(appt => {
            const apptDate = appt.Date ? appt.Date.substring(0, 10) : '';
            return apptDate === this.selectedDate;
        });
        
        listEl.innerHTML = "";
        
        if (dayAppts.length === 0) {
            listEl.innerHTML = `
                <div style="color: var(--text-muted); text-align: center; padding: 30px 15px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; border: 1px dashed var(--border-color); border-radius: 12px; background: var(--bg-color);">
                    <i class="far fa-calendar-times" style="font-size: 2.2rem; color: var(--text-muted); margin-bottom: 10px; opacity: 0.5;"></i>
                    <p style="margin: 0; font-weight: 500; font-size: 0.9rem;">No appointments scheduled</p>
                    <button class="btn btn-outline" onclick="Bookings.openBookingForSelected()" style="margin-top: 12px; padding: 4px 12px; font-size: 0.8rem;"><i class="fas fa-plus"></i> Book this Day</button>
                </div>
            `;
            return;
        }
        
        dayAppts.forEach(appt => {
            if (!appt.ApptID) return;
            const statusClass = appt.Status === "Confirmed" ? "background: rgba(40, 167, 69, 0.1); color: #28a745; border: 1px solid rgba(40, 167, 69, 0.2);" : (appt.Status === "Completed" ? "background: rgba(0, 123, 255, 0.1); color: #007bff; border: 1px solid rgba(0, 123, 255, 0.2);" : "background: rgba(212, 175, 55, 0.1); color: var(--primary-gold); border: 1px solid rgba(212, 175, 55, 0.2);");
            
            const notesText = appt.Notes || appt.notes || "";
            let notesHTML = "";
            if (notesText.trim()) {
                notesHTML = `
                    <div style="font-size: 0.8rem; color: var(--text-muted); background: var(--surface-color); border-left: 3px solid var(--primary-gold); padding: 6px 10px; border-radius: 4px; margin-top: 8px; word-break: break-word; line-height: 1.3;">
                        <i class="far fa-clipboard" style="color: var(--primary-gold); margin-right: 5px; font-size: 0.75rem;"></i>
                        <strong>Notes:</strong> ${notesText}
                    </div>
                `;
            }

            const advancePaid = parseFloat(appt.AdvancePaid || appt.advancePaid) || 0;
            const advanceMethod = appt.AdvanceMethod || appt.advanceMethod || "Cash";
            let advanceHTML = "";
            if (advancePaid > 0) {
                advanceHTML = `
                    <div style="font-size: 0.8rem; font-weight: 600; color: #28a745; background: rgba(40, 167, 69, 0.08); padding: 4px 10px; border-radius: 6px; border: 1px dashed rgba(40, 167, 69, 0.2); margin-top: 6px; display: inline-flex; align-items: center; gap: 6px; width: fit-content;">
                        <i class="fas fa-hand-holding-usd"></i> Advance Paid: Rs ${advancePaid} (${advanceMethod})
                    </div>
                `;
            }

            let actionButtonHTML = "";
            if (appt.Status !== "Completed" && appt.Status !== "Cancelled") {
                actionButtonHTML = `
                    <button class="btn btn-primary" onclick="Bookings.loadToPOS('${appt.ApptID}')" style="margin-top: 8px; font-size: 0.8rem; padding: 6px 12px; display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; border-radius: 8px; font-weight: 600;">
                        <i class="fas fa-cash-register"></i> Check-In & Load to POS
                    </button>
                `;
            }
            
            const card = document.createElement('div');
            card.style.cssText = "background: var(--bg-color); padding: 12px; border-radius: 10px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 4px; transition: var(--transition);";
            
            card.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                        <div style="font-size: 1rem; font-weight: bold; color: var(--primary-gold); font-family: monospace; min-width: 58px; background: var(--surface-color); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border-color); text-align: center; box-shadow: var(--shadow); flex-shrink: 0;">
                            ${appt.Time || "12:00"}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-size: 0.95rem; font-weight: bold; color: var(--text-primary); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${appt.CustomerName || "Unknown"}</div>
                            <div style="color: var(--text-muted); font-size: 0.8rem; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                <span><i class="fas fa-spa" style="color: var(--primary-gold); margin-right: 3px;"></i> ${appt.Services || "General"}</span>
                                <span>•</span>
                                <span>Staff: ${appt.Staff || "Any"}</span>
                            </div>
                        </div>
                    </div>
                    <div style="font-weight: 600; font-size: 0.75rem; padding: 2px 8px; border-radius: 20px; flex-shrink: 0; ${statusClass}">
                        ${appt.Status || "Pending"}
                    </div>
                </div>
                ${notesHTML}
                ${advanceHTML}
                ${actionButtonHTML}
            `;
            listEl.appendChild(card);
        });
    },

    renderAllUpcomingAppointments() {
        const listEl = document.getElementById('allUpcomingList');
        const badgeEl = document.getElementById('upcomingTotalBadge');
        if (!listEl) return;
        
        if (badgeEl) {
            badgeEl.textContent = `${this.filteredData.length} total`;
        }
        
        listEl.innerHTML = "";
        
        if (this.filteredData.length === 0) {
            listEl.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 20px; font-size: 0.85rem;">No upcoming appointments.</div>`;
            return;
        }
        
        const sorted = [...this.filteredData].sort((a, b) => {
            const dateComp = (a.Date || '').localeCompare(b.Date || '');
            if (dateComp !== 0) return dateComp;
            return (a.Time || '').localeCompare(b.Time || '');
        });
        
        sorted.forEach(appt => {
            if (!appt.ApptID) return;
            
            let formattedDate = appt.Date;
            try {
                const parts = appt.Date.split('-');
                if (parts.length === 3) {
                    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    formattedDate = `${parts[2]} ${monthNames[parseInt(parts[1]) - 1]}`;
                }
            } catch (e) {}
            
            const card = document.createElement('div');
            card.style.cssText = "background: var(--bg-color); padding: 12px; border-radius: 10px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 4px; cursor: pointer; transition: var(--transition);";
            
            card.addEventListener('click', () => {
                if (appt.Date) {
                    const [y, m, d] = appt.Date.split('-').map(Number);
                    this.currentYear = y;
                    this.currentMonth = m - 1;
                    this.selectedDate = appt.Date;
                    this.renderCalendar();
                    this.renderSelectedDayAppointments();
                }
            });
            
            const notesText = appt.Notes || appt.notes || "";
            let notesHTML = "";
            if (notesText.trim()) {
                notesHTML = `
                    <div style="font-size: 0.8rem; color: var(--text-muted); background: var(--surface-color); border-left: 3px solid var(--primary-gold); padding: 4px 8px; border-radius: 4px; margin-top: 6px; word-break: break-word; line-height: 1.3;">
                        <i class="far fa-clipboard" style="color: var(--primary-gold); margin-right: 4px; font-size: 0.7rem;"></i>
                        <strong>Notes:</strong> ${notesText}
                    </div>
                `;
            }

            const advancePaid = parseFloat(appt.AdvancePaid || appt.advancePaid) || 0;
            const advanceMethod = appt.AdvanceMethod || appt.advanceMethod || "Cash";
            let advanceHTML = "";
            if (advancePaid > 0) {
                advanceHTML = `
                    <div style="font-size: 0.75rem; font-weight: 600; color: #28a745; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                        <i class="fas fa-hand-holding-usd"></i> Advance Paid: Rs ${advancePaid} (${advanceMethod})
                    </div>
                `;
            }
            
            card.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%;">
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                        <div style="background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 4px; padding: 2px 6px; text-align: center; font-size: 0.7rem; font-weight: bold; color: var(--primary-gold); min-width: 50px; flex-shrink: 0; box-shadow: var(--shadow);">
                            ${formattedDate}
                        </div>
                        <div style="font-weight: bold; font-size: 0.75rem; font-family: monospace; color: var(--primary-gold); background: var(--surface-color); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color); text-align: center; box-shadow: var(--shadow); flex-shrink: 0;">
                            ${appt.Time || "12:00"}
                        </div>
                        <div style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">
                            ${appt.CustomerName || "Unknown"}
                        </div>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); background: var(--surface-color); border: 1px solid var(--border-color); padding: 2px 6px; border-radius: 12px; white-space: nowrap; flex-shrink: 0; max-width: 90px; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px;">
                        <i class="fas fa-spa" style="color: var(--primary-gold); font-size: 0.65rem;"></i> ${appt.Services || "General"}
                    </div>
                </div>
                ${notesHTML}
                ${advanceHTML}
            `;
            listEl.appendChild(card);
        });
    },

    openBookingForSelected() {
        const dateInput = document.getElementById('bookingDate');
        if (dateInput) {
            dateInput.value = this.selectedDate;
        }
        UI.openModal('bookingModal');
    },

    render() {
        this.renderCalendar();
        this.renderSelectedDayAppointments();
        this.renderAllUpcomingAppointments();
    },

    async save() {
        const customerName = document.getElementById('bookingCustomer')?.value;
        const date = document.getElementById('bookingDate')?.value;
        const time = document.getElementById('bookingTime')?.value;
        const services = document.getElementById('bookingService')?.value;
        const notes = document.getElementById('bookingNotes')?.value || "";
        const advancePaid = parseFloat(document.getElementById('bookingAdvancePaid')?.value) || 0;
        const advanceMethod = document.getElementById('bookingAdvanceMethod')?.value || "Cash";
        
        if (!customerName || !date || !time) {
            UI.showToast("Please fill all required fields", "error");
            return;
        }
        
        const payload = {
            customerName,
            date,
            time,
            services: services || "General",
            notes,
            phone: "",
            staff: "Any",
            duration: 60,
            advancePaid,
            advanceMethod
        };
        
        try {
            await API.request("createBooking", payload);
            UI.showToast("Booking created successfully!");
            UI.closeModal('bookingModal');
            document.getElementById('bookingForm').reset();
            
            // Set selectedDate to the booked day to let them see it immediately
            this.selectedDate = date;
            const [y, m, d] = date.split('-').map(Number);
            this.currentYear = y;
            this.currentMonth = m - 1;
            
            await this.load();
        } catch (e) {
            UI.showToast("Failed to create booking: " + e.message, "error");
            console.error("Booking add error:", e);
        }
    },

    loadToPOS(apptId) {
        const appt = this.data.find(a => a.ApptID === apptId);
        if (!appt) {
            UI.showToast("Appointment not found", "error");
            return;
        }

        // Switch to POS view
        UI.switchView('pos');

        // Clear current POS ticket
        POS.clear();

        // Track active appointment on POS so checkout can deduct and mark as Completed
        POS.activeAppointment = appt;

        // Set customer in POS
        let matchedCustomer = null;
        if (typeof Customers !== 'undefined' && Customers.data) {
            matchedCustomer = Customers.data.find(c => 
                c.Name.toLowerCase() === appt.CustomerName.toLowerCase() || 
                (appt.Phone && c.Phone === appt.Phone)
            );
        }

        if (matchedCustomer) {
            POS.setCustomer(matchedCustomer);
        } else {
            POS.selectedCustomer = { 
                CustomerID: "Walk-in", 
                Name: appt.CustomerName, 
                Phone: appt.Phone || "0000000",
                LoyaltyPoints: 0
            };
            const ticketCustomer = document.getElementById('ticketCustomer');
            if (ticketCustomer) {
                ticketCustomer.innerHTML = `
                    <p><strong>${appt.CustomerName} (Appointment)</strong> <br>
                    <small>${appt.Phone || 'No Phone'}</small></p>
                `;
            }
        }

        // Add matching services to ticket
        if (appt.Services) {
            const serviceNames = appt.Services.split(',').map(s => s.trim().toLowerCase());
            serviceNames.forEach(name => {
                if (!name) return;
                const foundSrv = POS.services.find(s => 
                    s.Name.toLowerCase() === name ||
                    s.Name.toLowerCase().includes(name) || 
                    name.includes(s.Name.toLowerCase())
                );
                if (foundSrv) {
                    POS.addToTicket(foundSrv);
                } else {
                    // Create a temporary custom item
                    POS.currentTicket.push({
                        ServiceID: "CUSTOM",
                        Name: appt.Services,
                        Price: 0,
                        FinalPrice: 0,
                        Type: "Service",
                        uid: Date.now() + Math.random(),
                        Quantity: 1
                    });
                }
            });
        }

        POS.renderTicket();
        UI.showToast(`Loaded appointment for ${appt.CustomerName} with Rs ${parseFloat(appt.AdvancePaid || 0)} advance!`);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const dateFilter = document.getElementById('bookingDateFilter');
    if (dateFilter) {
        dateFilter.addEventListener('change', (e) => {
            Bookings.jumpToDate(e.target.value);
        });
    }
});