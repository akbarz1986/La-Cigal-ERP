/**
 * Setup.gs
 * La Cigal Salon & Spa ERP - Database Setup
 * 
 * Run the `initializeDatabase` function once from your Google Apps Script editor
 * to set up all required sheets with their headers and sample initial data.
 */

function getSetupSpreadsheet() {
  let ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss && ss.getId()) return ss;
  } catch (e) {}

  try {
    const ssId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    if (ssId && ssId.trim().length > 0) {
      return SpreadsheetApp.openById(ssId.trim());
    }
  } catch (e) {}

  try {
    const files = DriveApp.getFilesByName("La Cigal Salon & Spa ERP");
    if (files.hasNext()) {
      return SpreadsheetApp.open(files.next());
    }
  } catch (e) {}

  throw new Error("No active or configured spreadsheet found! Please either create this script from inside a Google Sheet, or add 'SPREADSHEET_ID' to Script Properties.");
}

function initializeDatabase() {
  const ss = getSetupSpreadsheet();
  Logger.log("Starting database initialization for spreadsheet: " + ss.getName() + " (" + ss.getId() + ")");
  
  const schema = {
    "Settings": [
      ["Key", "Value"],
      ["taxRate", "0.0"],
      ["currencySymbol", "Rs"],
      ["loyaltyRate", "0.05"]
    ],
    "Users": [
      ["UserID", "Name", "Role", "PIN", "Email", "Status"],
      ["U001", "CEO", "CEO", "1234", "ceo@lacigal.com", "Active"],
      ["U002", "Manager", "Manager", "5678", "manager@lacigal.com", "Active"],
      ["U003", "Receptionist", "Staff", "4321", "staff@lacigal.com", "Active"]
    ],
    "Services": [
      ["ServiceID", "Name", "Category", "Price", "Duration"],
      ["S001", "Signature Facial", "Facial", "2500", "60"],
      ["S002", "Swedish Massage", "Massage", "3500", "60"],
      ["S003", "Classic Manicure", "Nail Care", "1200", "45"],
      ["S004", "Classic Pedicure", "Nail Care", "1500", "45"],
      ["S005", "Hair Cut & Style", "Hair", "2000", "45"],
      ["S006", "Bridal Makeup", "Makeup", "15000", "120"]
    ],
    "Inventory": [
      ["SKU", "Name", "Category", "Stock", "Price", "MinStock", "PurchasePrice", "Expiry"],
      ["P001", "Argan Hair Oil", "Hair Care", "25", "1800", "5", "1200", "2027-12-31"],
      ["P002", "Hydrating Face Mask", "Skincare", "12", "950", "5", "600", "2027-06-30"],
      ["P003", "Organic Massage Lotion", "Massage", "8", "2200", "3", "1500", "2027-08-15"]
    ],
    "Customers": [
      ["CustomerID", "Name", "Phone", "Email", "WhatsApp", "Birthday", "Anniversary", "Notes", "LoyaltyPoints", "VisitCount", "LifetimeSpend"],
      ["C001", "Walk-in Customer", "0000000", "walkin@lacigal.com", "0000000", "", "", "Default walk-in client", "0", "0", "0"],
      ["C002", "Ayesha Khan", "03001234567", "ayesha@gmail.com", "03001234567", "1995-05-12", "", "Prefers lavender oils", "120", "4", "14500"],
      ["C003", "Zainab Malik", "03217654321", "zainab.m@yahoo.com", "03217654321", "1990-11-20", "2015-11-25", "Interested in Bridal packages", "350", "7", "42000"]
    ],
    "Appointments": [
      ["ApptID", "CustomerName", "Phone", "Date", "Time", "Services", "Staff", "Duration", "Status"],
      ["A001", "Ayesha Khan", "03001234567", "2026-07-11", "14:00", "Signature Facial", "Maria", "60", "Confirmed"],
      ["A002", "Zainab Malik", "03217654321", "2026-07-11", "16:30", "Hair Cut & Style", "Sana", "45", "Pending"]
    ],
    "Suppliers": [
      ["SupplierID", "Name", "Company", "ContactPerson", "Phone", "Email", "Address", "PaymentTerms"],
      ["SUP001", "L'Oreal Pakistan", "L'Oreal", "Kamran Shah", "03009876543", "kamran.shah@loreal.pk", "Karachi Office", "Net 30"]
    ],
    "PurchaseOrders": [
      ["POID", "SupplierID", "ExpectedDelivery", "Items", "TotalCost", "Status", "Date"]
    ],
    "Expenses": [
      ["ExpenseID", "Date", "Category", "Amount", "PaymentMethod", "Notes"],
      ["EXP001", "2026-07-10", "Utilities", "8500", "Cash", "Electricity Bill June"],
      ["EXP002", "2026-07-10", "Salaries", "45000", "Bank Transfer", "Staff salary portion"]
    ],
    "Credits": [
      ["CreditID", "CustomerID", "Amount", "Date", "Status", "Notes"]
    ],
    "Refunds": [
      ["RefundID", "OriginalBillID", "RefundAmount", "RefundMethod", "Reason", "Notes", "Date"]
    ],
    "Sales": [
      ["BillID", "Date", "CustomerID", "CustomerName", "Subtotal", "Discount", "Tax", "Total", "PaymentMethod", "Items", "AmountReceived", "Change", "VoucherCode", "RemainingBalance", "User"]
    ],
    "Vouchers": [
      ["Code", "Type", "Value", "Expiry", "Status"],
      ["WELCOME10", "Percentage", "10", "2030-12-31", "Active"],
      ["FLAT500", "Flat", "500", "2030-12-31", "Active"]
    ],
    "Packages": [
      ["PackageID", "Name", "Price", "Description", "Status"],
      ["PKG001", "Super Glow Facial & Massage", "5000", "Includes Signature Facial and Swedish Massage at a discount", "Active"]
    ],
    "PackageItems": [
      ["PackageItemID", "PackageID", "ServiceID", "OriginalPrice", "DiscountPercent", "DiscountAmount", "FinalPrice"],
      ["PKGI001", "PKG001", "S001", "2500", "10", "250", "2250"],
      ["PKGI002", "PKG001", "S002", "3500", "21.4", "750", "2750"]
    ]
  };

  for (const sheetName in schema) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      Logger.log("Created sheet: " + sheetName);
    }
    
    // Check if sheet has headers
    const lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      const data = schema[sheetName];
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
      Logger.log(`Initialized headers and sample rows for: ${sheetName}`);
      
      // Auto-fit columns
      sheet.autoResizeColumns(1, data[0].length);
    }
  }
  
  Logger.log("Database initialization completed successfully!");
}
