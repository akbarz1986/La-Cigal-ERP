/**
 * API.gs
 * La Cigal Salon & Spa ERP - Business Logic Handlers
 * 
 * Implements all backend actions that execute against Google Sheets.
 */

// Global config variables
const LOYALTY_RATE = 0.05; // 5% of total bill earned as loyalty points

/**
 * Dispatches the action to the corresponding handler.
 * Called by code.gs.
 */
function dispatchAction(action, payload, user) {
  switch (action) {
    // ---------------- READ OPERATIONS ----------------
    case "getServices":
      return getSheetRows("Services");
    case "getInventory":
      return getSheetRows("Inventory");
    case "getRawInventory":
      try {
        var ss = getSpreadsheet();
        var sheet = ss.getSheetByName("Inventory");
        if (!sheet) return { error: "No Sheet" };
        var lastRow = sheet.getLastRow();
        var lastCol = sheet.getLastColumn();
        var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        var values = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];
        return { headers: headers, values: values };
      } catch (e) {
        return { error: e.toString() };
      }
    case "getCustomers":
      return getSheetRows("Customers");
    case "getAppointments":
      return getSheetRows("Appointments");
    case "getSuppliers":
      return getSheetRows("Suppliers");
    case "getExpenses":
      return getSheetRows("Expenses");
    case "getCredits":
      return getSheetRows("Credits");
    case "getRefunds":
      return getSheetRows("Refunds");
    case "getUsers":
      return getSheetRows("Users");
    case "getSettings":
      return getSheetRows("Settings");
    case "getPackages":
      return getSheetRows("Packages");
    case "getPackageItems":
      return getSheetRows("PackageItems");
      
    // ---------------- SPECIAL READ OPERATIONS ----------------
    case "getDashboardStats":
      return getDashboardStatsHandler();
    case "getReports":
      return getReportsHandler();
    case "validateVoucher":
      return validateVoucherHandler(payload);
      
    // ---------------- AUTHENTICATION ----------------
    case "authenticate":
      return authenticateHandler(payload);
      
    // ---------------- WRITE OPERATIONS ----------------
    case "addCustomer":
      return addCustomerHandler(payload);
    case "createBooking":
      return createBookingHandler(payload);
    case "addInventoryItem":
      return addInventoryItemHandler(payload);
    case "bulkAddStock":
      return bulkAddStockHandler(payload);
    case "processPayment":
      return processPaymentHandler(payload, user);
    case "addSupplier":
      return addSupplierHandler(payload);
    case "addPurchaseOrder":
      return addPurchaseOrderHandler(payload);
    case "processRefund":
      return processRefundHandler(payload);
    case "addExpense":
      return addExpenseHandler(payload);
    case "recordCreditPayment":
      return recordCreditPaymentHandler(payload);
    case "updateSetting":
      return updateSettingHandler(payload);
    case "addUser":
      return addUserHandler(payload);
    case "updateUser":
      return updateUserHandler(payload);
    case "addPackage":
      return addPackageHandler(payload);
    case "updatePackage":
      return updatePackageHandler(payload);
    case "deletePackage":
      return deletePackageHandler(payload);
      
    default:
      throw new Error(`Action '${action}' is not supported.`);
  }
}

// ==========================================
// GENERIC GOOGLE SHEETS HELPERS
// ==========================================

/**
 * Gets the active or configured Spreadsheet.
 * Supports container-bound scripts and standalone scripts via SPREADSHEET_ID script property.
 */
function getSpreadsheet() {
  let ss = null;
  
  // 1. Try to get the active spreadsheet (for bound scripts)
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss && ss.getId()) {
      return ss;
    }
  } catch (e) {
    Logger.log("getActiveSpreadsheet() failed or not bound: " + e.toString());
  }
  
  // 2. Try ScriptProperties (for standalone scripts)
  try {
    const ssId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    if (ssId && ssId.trim().length > 0) {
      return SpreadsheetApp.openById(ssId.trim());
    }
  } catch (e) {
    Logger.log("Failed to open spreadsheet by stored SPREADSHEET_ID: " + e.toString());
  }
  
  // 3. Fallback: Search in user's Drive for any spreadsheet named "La Cigal Salon & Spa ERP"
  try {
    const files = DriveApp.getFilesByName("La Cigal Salon & Spa ERP");
    if (files.hasNext()) {
      const file = files.next();
      return SpreadsheetApp.open(file);
    }
  } catch (e) {
    Logger.log("DriveApp search for 'La Cigal Salon & Spa ERP' failed: " + e.toString());
  }
  
  throw new Error("Spreadsheet not found! If you are using a standalone Apps Script (not bound to a Google Sheet), you must add 'SPREADSHEET_ID' with your Sheet's ID to your project's Script Properties (Project Settings > Script Properties).");
}

/**
 * Gets all rows from a sheet mapped to objects using the headers.
 */
function getSheetRows(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return [];
  
  const range = sheet.getRange(2, 1, lastRow - 1, lastCol);
  const values = range.getValues();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  return values.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      // Convert Date objects to ISO strings or formatted dates
      let val = row[index];
      if (val instanceof Date) {
        val = val.toISOString().split('T')[0];
      }
      obj[header] = val;
    });
    
    // Normalization for Inventory sheet to support multiple column naming conventions
    if (sheetName === "Inventory") {
      const name = obj.Name || "";
      let sku = obj.SKU !== undefined && obj.SKU !== "" ? String(obj.SKU) : (obj.ProductID !== undefined && obj.ProductID !== "" ? String(obj.ProductID) : "");
      
      // Auto-resolve case where user confused SKU column with Stock (SKU is numeric and Stock is empty/missing)
      const rawCurrentStock = obj.CurrentStock !== undefined && obj.CurrentStock !== "" ? String(obj.CurrentStock) : (obj.Stock !== undefined && obj.Stock !== "" ? String(obj.Stock) : "");
      if (rawCurrentStock === "" && sku !== "" && !isNaN(sku)) {
        obj.CurrentStock = parseInt(sku);
        obj.Stock = parseInt(sku);
        sku = "";
      }
      
      // Auto-generate SKU if missing and name is available
      if (!sku && name) {
        sku = name.toUpperCase().replace(/[^A-Z0-9]/g, "-").replace(/-+/g, "-");
        if (sku.endsWith("-")) sku = sku.slice(0, -1);
        if (sku.startsWith("-")) sku = sku.slice(1);
        if (!sku) sku = "PROD-" + Math.floor(1000 + Math.random() * 9000);
      }
      
      const pid = obj.ProductID !== undefined && obj.ProductID !== "" ? String(obj.ProductID) : sku;
      const stock = obj.CurrentStock !== undefined && obj.CurrentStock !== "" ? parseInt(obj.CurrentStock) : (obj.Stock !== undefined && obj.Stock !== "" ? parseInt(obj.Stock) : 0);
      const price = obj.SellingPrice !== undefined && obj.SellingPrice !== "" ? parseFloat(obj.SellingPrice) : (obj.Price !== undefined && obj.Price !== "" ? parseFloat(obj.Price) : 0);
      const minStock = obj.MinStock !== undefined && obj.MinStock !== "" ? parseInt(obj.MinStock) : 5;
      const purchasePrice = obj.PurchasePrice !== undefined && obj.PurchasePrice !== "" ? parseFloat(obj.PurchasePrice) : 0;
      
      obj.SKU = sku;
      obj.ProductID = pid;
      obj.Stock = isNaN(stock) ? 0 : stock;
      obj.CurrentStock = isNaN(stock) ? 0 : stock;
      obj.Price = isNaN(price) ? 0 : price;
      obj.SellingPrice = isNaN(price) ? 0 : price;
      obj.MinStock = isNaN(minStock) ? 5 : minStock;
      obj.PurchasePrice = isNaN(purchasePrice) ? 0 : purchasePrice;
    }
    
    return obj;
  });
}

/**
 * Ensures specified header columns exist in a sheet.
 */
function ensureSheetHeaders(sheet, requiredHeaders) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return;
  }
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const missingHeaders = [];
  requiredHeaders.forEach(h => {
    if (headers.indexOf(h) === -1) {
      missingHeaders.push(h);
    }
  });
  if (missingHeaders.length > 0) {
    sheet.getRange(1, lastCol + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }
}

/**
 * Appends a row to a sheet mapping keys in the object to sheet headers.
 */
function appendSheetRow(sheetName, obj) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found: " + sheetName);
  
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  const row = headers.map(header => {
    if (obj[header] !== undefined) return obj[header];
    
    // Check with spaces removed and case-insensitive
    const cleanHeader = header.replace(/\s+/g, "").toLowerCase();
    for (const key in obj) {
      const cleanKey = key.replace(/\s+/g, "").toLowerCase();
      if (cleanKey === cleanHeader) {
        return obj[key];
      }
    }
    
    // Fallback for stock/currentstock
    if (cleanHeader === "currentstock" || cleanHeader === "stock") {
      return obj.CurrentStock !== undefined ? obj.CurrentStock : (obj.Stock !== undefined ? obj.Stock : "");
    }
    // Fallback for selling price / price
    if (cleanHeader === "sellingprice" || cleanHeader === "price") {
      return obj.SellingPrice !== undefined ? obj.SellingPrice : (obj.Price !== undefined ? obj.Price : "");
    }
    
    return "";
  });
  
  sheet.appendRow(row);
  return obj;
}

/**
 * Updates a row in a sheet matching keyField = keyValue.
 */
function updateSheetRow(sheetName, keyField, keyValue, updateObj) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found: " + sheetName);
  
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return false;
  
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let keyIndex = headers.indexOf(keyField);
  
  // Robust fallback key lookup for Inventory sheet
  if (keyIndex === -1 && sheetName === "Inventory") {
    if (keyField === "SKU") {
      keyIndex = headers.indexOf("ProductID");
      if (keyIndex === -1) keyIndex = headers.indexOf("Name");
    }
  }
  
  if (keyIndex === -1) throw new Error(`Key field '${keyField}' not found in headers.`);
  
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (let i = 0; i < values.length; i++) {
    let isMatch = false;
    if (String(values[i][keyIndex]) === String(keyValue)) {
      isMatch = true;
    } else if (sheetName === "Inventory" && keyField === "SKU") {
      // Robust key matching (SKU, ProductID, or Name) for manually entered items
      const skuIndex = headers.indexOf("SKU");
      const pidIndex = headers.indexOf("ProductID");
      const nameIndex = headers.indexOf("Name");
      
      const rowSKU = skuIndex !== -1 ? String(values[i][skuIndex]) : "";
      const rowPID = pidIndex !== -1 ? String(values[i][pidIndex]) : "";
      const rowName = nameIndex !== -1 ? String(values[i][nameIndex]) : "";
      
      if ((rowSKU && rowSKU === String(keyValue)) || 
          (rowPID && rowPID === String(keyValue)) || 
          (rowName && rowName === String(keyValue))) {
        isMatch = true;
      }
    }
    
    if (isMatch) {
      const rowIndex = i + 2; // 2 because 1-indexed and header row
      for (const key in updateObj) {
        let colIndex = headers.indexOf(key);
        if (colIndex === -1) {
          const cleanKey = key.replace(/\s+/g, "").toLowerCase();
          for (let j = 0; j < headers.length; j++) {
            const cleanHeader = headers[j].replace(/\s+/g, "").toLowerCase();
            if (cleanHeader === cleanKey || 
                (cleanKey === "currentstock" && cleanHeader === "stock") ||
                (cleanKey === "stock" && cleanHeader === "currentstock")) {
              colIndex = j;
              break;
            }
          }
        }
        
        if (colIndex !== -1) {
          sheet.getRange(rowIndex, colIndex + 1).setValue(updateObj[key]);
        }
      }
      return true;
    }
  }
  return false;
}

// ==========================================
// BUSINESS LOGIC ACTION HANDLERS
// ==========================================

/**
 * Authenticates a user by matching their 4-digit PIN.
 */
function authenticateHandler(payload) {
  const users = getSheetRows("Users");
  const user = users.find(u => String(u.PIN) === String(payload.pin) && u.Status === "Active");
  if (!user) {
    throw new Error("Invalid PIN. Please try again.");
  }
  return {
    Name: user.Name,
    Role: user.Role
  };
}

/**
 * Registers a new customer and generates a customer ID.
 */
function addCustomerHandler(payload) {
  const customers = getSheetRows("Customers");
  
  // Calculate next ID like C004
  let maxIdNum = 0;
  customers.forEach(c => {
    if (c.CustomerID && c.CustomerID.startsWith("C")) {
      const num = parseInt(c.CustomerID.substring(1));
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
  });
  const nextId = "C" + String(maxIdNum + 1).padStart(3, '0');
  
  const newCust = {
    CustomerID: nextId,
    Name: payload.name,
    Phone: payload.phone,
    Email: payload.email || "",
    WhatsApp: payload.whatsapp || "",
    Birthday: payload.birthday || "",
    Anniversary: payload.anniversary || "",
    Notes: payload.notes || "",
    LoyaltyPoints: 0,
    VisitCount: 0,
    LifetimeSpend: 0
  };
  
  appendSheetRow("Customers", newCust);
  return newCust;
}

/**
 * Creates an appointment booking.
 */
function createBookingHandler(payload) {
  const appointments = getSheetRows("Appointments");
  
  let maxIdNum = 0;
  appointments.forEach(a => {
    if (a.ApptID && a.ApptID.startsWith("A")) {
      const num = parseInt(a.ApptID.substring(1));
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
  });
  const nextId = "A" + String(maxIdNum + 1).padStart(3, '0');
  
  const newAppt = {
    ApptID: nextId,
    CustomerName: payload.customerName,
    Phone: payload.phone || "",
    Date: payload.date,
    Time: payload.time,
    Services: payload.services || "General",
    Staff: payload.staff || "Any",
    Duration: payload.duration || 60,
    Status: "Pending"
  };
  
  appendSheetRow("Appointments", newAppt);
  return newAppt;
}

/**
 * Adds an item to inventory.
 */
function addInventoryItemHandler(payload) {
  const items = getSheetRows("Inventory");
  const existing = items.find(i => i.SKU === payload.sku || i.ProductID === payload.sku);
  if (existing) {
    throw new Error(`Product with SKU '${payload.sku}' already exists.`);
  }
  
  const newItem = {
    ProductID: payload.sku,
    SKU: payload.sku,
    Name: payload.name,
    Category: payload.category || "Uncategorized",
    Stock: parseInt(payload.stock) || 0,
    CurrentStock: parseInt(payload.stock) || 0,
    Price: parseFloat(payload.price) || 0,
    SellingPrice: parseFloat(payload.price) || 0,
    MinStock: parseInt(payload.minStock) || 5,
    PurchasePrice: parseFloat(payload.purchasePrice) || 0,
    Expiry: payload.expiry || "",
    Barcode: payload.barcode || payload.sku || ""
  };
  
  appendSheetRow("Inventory", newItem);
  return newItem;
}

/**
 * Bulk updates stock quantities for inventory items.
 */
function bulkAddStockHandler(payload) {
  const itemsToAdd = payload.items || [];
  if (itemsToAdd.length === 0) return { success: true, updated: 0 };

  const inventory = getSheetRows("Inventory");
  let updatedCount = 0;

  itemsToAdd.forEach(item => {
    const invItem = inventory.find(i => i.SKU === item.SKU || i.ProductID === item.SKU);
    if (invItem) {
      const addQty = parseInt(item.AddQty) || 0;
      if (addQty !== 0) {
        const currentStock = parseInt(invItem.Stock) || 0;
        const newStock = Math.max(0, currentStock + addQty);
        invItem.Stock = newStock; // update locally for future rows
        invItem.CurrentStock = newStock;
        
        updateSheetRow("Inventory", "SKU", item.SKU, {
          Stock: newStock,
          CurrentStock: newStock
        });
        updatedCount++;
      }
    }
  });

  return { success: true, updated: updatedCount };
}

/**
 * Validates a discount voucher code.
 */
function validateVoucherHandler(payload) {
  const vouchers = getSheetRows("Vouchers");
  const code = String(payload.code).toUpperCase().trim();
  const voucher = vouchers.find(v => String(v.Code).toUpperCase() === code);
  
  if (!voucher) {
    return { valid: false, message: "Invalid voucher code." };
  }
  
  if (voucher.Status !== "Active") {
    return { valid: false, message: "This voucher is inactive." };
  }
  
  if (voucher.Expiry) {
    const expiryDate = new Date(voucher.Expiry);
    const today = new Date();
    today.setHours(0,0,0,0);
    if (expiryDate < today) {
      return { valid: false, message: "This voucher has expired." };
    }
  }
  
  return {
    valid: true,
    code: voucher.Code,
    type: voucher.Type,
    value: parseFloat(voucher.Value)
  };
}

/**
 * Processes checkout, saves invoice, handles splits, decreases inventory, updates loyalty.
 */
function processPaymentHandler(payload, user) {
  const sales = getSheetRows("Sales");
  
  // Create unique Invoice/Bill Number like BILL-004
  let maxIdNum = 0;
  sales.forEach(s => {
    if (s.BillID && s.BillID.startsWith("BILL-")) {
      const num = parseInt(s.BillID.substring(5));
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
  });
  const invoiceNumber = "BILL-" + String(maxIdNum + 1).padStart(5, '0');
  
  const todayStr = new Date().toISOString().split('T')[0];
  
  const saleRecord = {
    BillID: invoiceNumber,
    Date: todayStr,
    CustomerID: payload.customerID || "Walk-in",
    CustomerName: payload.customerName || "Walk-in Customer",
    Subtotal: parseFloat(payload.subtotal) || 0,
    Discount: typeof payload.discount !== 'undefined' ? parseFloat(payload.discount) : ((parseFloat(payload.billDiscount) || 0) + (parseFloat(payload.voucherDiscounts) || 0)),
    Tax: parseFloat(payload.tax) || 0,
    Total: parseFloat(payload.total) || 0,
    PaymentMethod: payload.paymentMethod || "Cash",
    Items: JSON.stringify(payload.items || []),
    AmountReceived: parseFloat(payload.amountReceived) || 0,
    Change: parseFloat(payload.change) || 0,
    VoucherCode: payload.voucherCode || "",
    RemainingBalance: parseFloat(payload.remainingBalance) || 0,
    User: user
  };
  
  appendSheetRow("Sales", saleRecord);
  
  // 1. Update Customer Loyalty Points and Stats if registered
  if (saleRecord.CustomerID && saleRecord.CustomerID !== "Walk-in") {
    const customers = getSheetRows("Customers");
    const customer = customers.find(c => c.CustomerID === saleRecord.CustomerID);
    if (customer) {
      const newPoints = (parseInt(customer.LoyaltyPoints) || 0) + Math.floor(saleRecord.Total * LOYALTY_RATE);
      const newVisitCount = (parseInt(customer.VisitCount) || 0) + 1;
      const newSpend = (parseFloat(customer.LifetimeSpend) || 0) + saleRecord.Total;
      
      updateSheetRow("Customers", "CustomerID", saleRecord.CustomerID, {
        LoyaltyPoints: newPoints,
        VisitCount: newVisitCount,
        LifetimeSpend: newSpend
      });
    }
  }
  
  // 2. Reduce Inventory Stock
  const items = payload.items || [];
  if (items.length > 0) {
    const inventory = getSheetRows("Inventory");
    items.forEach(saleItem => {
      // Find matching item in Inventory by SKU
      const invItem = inventory.find(i => i.SKU === saleItem.SKU || i.Name === saleItem.Name);
      if (invItem) {
        const qty = parseInt(saleItem.qty || saleItem.Quantity || 1);
        const currentStock = parseInt(invItem.Stock) || 0;
        const newStock = Math.max(0, currentStock - qty);
        invItem.Stock = newStock; // Update locally for next iterations
        invItem.CurrentStock = newStock;
        updateSheetRow("Inventory", "SKU", invItem.SKU, {
          Stock: newStock,
          CurrentStock: newStock
        });
      }
    });
  }
  
  // 3. Handle Credits
  if (saleRecord.RemainingBalance > 0 && saleRecord.CustomerID !== "Walk-in") {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName("Credits");
    if (sheet) {
      ensureSheetHeaders(sheet, ["CreditID", "CustomerID", "InvoiceNumber", "OutstandingBal", "PaidAmount", "RemainingAmo", "DueDate", "Notes", "Status", "PaymentDate", "MOP"]);
    }
    
    const credits = getSheetRows("Credits");
    let maxCreditNum = 0;
    credits.forEach(cr => {
      if (cr.CreditID && cr.CreditID.startsWith("CR-")) {
        const num = parseInt(cr.CreditID.substring(3));
        if (!isNaN(num) && num > maxCreditNum) maxCreditNum = num;
      }
    });
    const creditID = "CR-" + String(maxCreditNum + 1).padStart(4, '0');
    
    const creditRecord = {
      CreditID: creditID,
      CustomerID: saleRecord.CustomerID,
      InvoiceNumber: saleRecord.BillID,
      OutstandingBal: saleRecord.RemainingBalance,
      OutstandingBalance: saleRecord.RemainingBalance,
      PaidAmount: 0,
      RemainingAmo: saleRecord.RemainingBalance,
      RemainingAmount: saleRecord.RemainingBalance,
      Amount: saleRecord.RemainingBalance,
      Date: todayStr,
      DueDate: "",
      Status: "Unpaid",
      Notes: `Due from bill ${saleRecord.BillID}`,
      PaymentDate: "",
      MOP: ""
    };
    appendSheetRow("Credits", creditRecord);
  }
  
  return {
    invoiceNumber: invoiceNumber,
    total: saleRecord.Total,
    change: saleRecord.Change
  };
}

/**
 * Adds a new Supplier.
 */
function addSupplierHandler(payload) {
  const suppliers = getSheetRows("Suppliers");
  let maxIdNum = 0;
  suppliers.forEach(s => {
    if (s.SupplierID && s.SupplierID.startsWith("SUP")) {
      const num = parseInt(s.SupplierID.substring(3));
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
  });
  const nextId = "SUP" + String(maxIdNum + 1).padStart(3, '0');
  
  const newSup = {
    SupplierID: nextId,
    Name: payload.name,
    Company: payload.company || "",
    ContactPerson: payload.contactPerson || "",
    Phone: payload.phone,
    Email: payload.email || "",
    Address: payload.address || "",
    PaymentTerms: payload.paymentTerms || "Cash"
  };
  
  appendSheetRow("Suppliers", newSup);
  return newSup;
}

/**
 * Records a Purchase Order.
 */
function addPurchaseOrderHandler(payload) {
  const orders = getSheetRows("PurchaseOrders");
  let maxIdNum = 0;
  orders.forEach(o => {
    if (o.POID && o.POID.startsWith("PO-")) {
      const num = parseInt(o.POID.substring(3));
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
  });
  const nextId = "PO-" + String(maxIdNum + 1).padStart(4, '0');
  const todayStr = new Date().toISOString().split('T')[0];
  
  const newOrder = {
    POID: nextId,
    SupplierID: payload.supplierID,
    ExpectedDelivery: payload.expectedDelivery || "",
    Items: JSON.stringify(payload.items || []),
    TotalCost: parseFloat(payload.totalCost) || 0,
    Status: "Pending",
    Date: todayStr
  };
  
  appendSheetRow("PurchaseOrders", newOrder);
  return newOrder;
}

/**
 * Records a Refund.
 */
function processRefundHandler(payload) {
  const refunds = getSheetRows("Refunds");
  let maxIdNum = 0;
  refunds.forEach(r => {
    if (r.RefundID && r.RefundID.startsWith("REF-")) {
      const num = parseInt(r.RefundID.substring(4));
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
  });
  const nextId = "REF-" + String(maxIdNum + 1).padStart(4, '0');
  const todayStr = new Date().toISOString().split('T')[0];
  
  const newRefund = {
    RefundID: nextId,
    OriginalBillID: payload.originalBillID,
    RefundAmount: parseFloat(payload.refundAmount) || 0,
    RefundMethod: payload.refundMethod || "Cash",
    Reason: payload.reason || "",
    Notes: payload.notes || "",
    Date: todayStr
  };
  
  appendSheetRow("Refunds", newRefund);
  
  // Tag original sales record if found
  updateSheetRow("Sales", "BillID", payload.originalBillID, {
    PaymentMethod: `Refunded (Rs ${newRefund.RefundAmount})`
  });
  
  return newRefund;
}

/**
 * Records a business Expense.
 */
function addExpenseHandler(payload) {
  const expenses = getSheetRows("Expenses");
  let maxIdNum = 0;
  expenses.forEach(e => {
    if (e.ExpenseID && e.ExpenseID.startsWith("EXP")) {
      const num = parseInt(e.ExpenseID.substring(3));
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
  });
  const nextId = "EXP" + String(maxIdNum + 1).padStart(3, '0');
  
  const newExpense = {
    ExpenseID: nextId,
    Date: payload.date || new Date().toISOString().split('T')[0],
    Category: payload.category || "General",
    Amount: parseFloat(payload.amount) || 0,
    PaymentMethod: payload.paymentMethod || "Cash",
    Notes: payload.notes || ""
  };
  
  appendSheetRow("Expenses", newExpense);
  return newExpense;
}

/**
 * Records payment against a customer credit due.
 */
function recordCreditPaymentHandler(payload) {
  const creditID = payload.creditID;
  
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Credits");
  if (sheet) {
    ensureSheetHeaders(sheet, ["CreditID", "CustomerID", "InvoiceNumber", "OutstandingBal", "PaidAmount", "RemainingAmo", "DueDate", "Notes", "Status", "PaymentDate", "MOP"]);
  }
  
  const credits = getSheetRows("Credits");
  const credit = credits.find(c => c.CreditID === creditID);
  
  if (!credit) {
    throw new Error(`Credit ID '${creditID}' not found.`);
  }
  
  const originalOutstanding = parseFloat(credit.OutstandingBal !== undefined ? credit.OutstandingBal : (credit.OutstandingBalance !== undefined ? credit.OutstandingBalance : credit.Amount)) || 0;
  const currentPaid = parseFloat(credit.PaidAmount) || 0;
  const payAmount = parseFloat(payload.amount) || 0;
  
  const newPaid = currentPaid + payAmount;
  const newRemaining = Math.max(0, originalOutstanding - newPaid);
  const newStatus = newRemaining <= 0 ? "Paid" : "Partially Paid";
  const todayStr = new Date().toISOString().split('T')[0];
  const payDateStr = payload.date || todayStr;
  const mopStr = payload.method || "Cash";
  
  // Also support standard single-Amount schema
  const oldRemainingStandard = parseFloat(credit.Amount) || 0;
  const newAmountStandard = Math.max(0, oldRemainingStandard - payAmount);
  
  updateSheetRow("Credits", "CreditID", creditID, {
    Amount: newAmountStandard,
    PaidAmount: newPaid,
    RemainingAmo: newRemaining,
    RemainingAmount: newRemaining,
    Status: newStatus,
    Notes: `${credit.Notes || ''} | Paid Rs ${payAmount} on ${payDateStr} via ${mopStr}.`,
    PaymentDate: payDateStr,
    MOP: mopStr
  });
  
  // Also log the collection as a Sale transaction
  const sales = getSheetRows("Sales");
  let maxIdNum = 0;
  sales.forEach(s => {
    if (s.BillID && s.BillID.startsWith("BILL-")) {
      const num = parseInt(s.BillID.substring(5));
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
  });
  const invoiceNumber = "BILL-" + String(maxIdNum + 1).padStart(5, '0');
  
  appendSheetRow("Sales", {
    BillID: invoiceNumber,
    Date: payDateStr,
    CustomerID: credit.CustomerID,
    CustomerName: `Credit Collection (${creditID})`,
    Subtotal: payAmount,
    Discount: 0,
    Tax: 0,
    Total: payAmount,
    PaymentMethod: mopStr,
    Items: JSON.stringify([{ Name: "Credit Payback", SKU: "CREDIT_PAY", Price: payAmount, qty: 1 }]),
    AmountReceived: payAmount,
    Change: 0,
    VoucherCode: "",
    RemainingBalance: 0,
    User: "Staff"
  });
  
  return { success: true, remaining: newRemaining };
}

/**
 * Updates system Settings.
 */
function updateSettingHandler(payload) {
  return updateSheetRow("Settings", "Key", payload.key, {
    Value: String(payload.value)
  });
}

/**
 * Registers a new ERP User.
 */
function addUserHandler(payload) {
  const users = getSheetRows("Users");
  let maxIdNum = 0;
  users.forEach(u => {
    if (u.UserID && u.UserID.startsWith("U")) {
      const num = parseInt(u.UserID.substring(1));
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
  });
  const nextId = "U" + String(maxIdNum + 1).padStart(3, '0');
  
  const newUser = {
    UserID: nextId,
    Name: payload.name,
    Role: payload.role || "Staff",
    PIN: String(payload.pin),
    Email: payload.email || "",
    Status: "Active"
  };
  
  appendSheetRow("Users", newUser);
  return newUser;
}

/**
 * Updates a User's status.
 */
function updateUserHandler(payload) {
  return updateSheetRow("Users", "UserID", payload.userID, {
    Status: payload.status
  });
}

/**
 * Calculates current KPI statistics for Dashboard view.
 */
function getDashboardStatsHandler() {
  const sales = getSheetRows("Sales");
  const expenses = getSheetRows("Expenses");
  const customers = getSheetRows("Customers");
  const appointments = getSheetRows("Appointments");
  const inventory = getSheetRows("Inventory");
  
  const todayStr = new Date().toISOString().split('T')[0];
  const thisMonthStr = todayStr.substring(0, 7); // YYYY-MM
  
  // Calculate Totals
  let totalRevenue = 0;
  let totalBills = 0;
  sales.forEach(s => {
    if (s.Date && s.Date.substring(0, 7) === thisMonthStr) {
      totalRevenue += parseFloat(s.Total) || 0;
      totalBills++;
    }
  });
  
  let totalExpenses = 0;
  expenses.forEach(e => {
    if (e.Date && e.Date.substring(0, 7) === thisMonthStr) {
      totalExpenses += parseFloat(e.Amount) || 0;
    }
  });
  
  let todayAppointments = 0;
  let monthlyBookings = 0;
  appointments.forEach(a => {
    if (a.Date === todayStr) {
      todayAppointments++;
    }
    if (a.Date && a.Date.substring(0, 7) === thisMonthStr) {
      monthlyBookings++;
    }
  });
  
  let lowStockItems = 0;
  inventory.forEach(i => {
    const stock = parseInt(i.Stock) || 0;
    const minStock = parseInt(i.MinStock) || 5;
    if (stock <= minStock) {
      lowStockItems++;
    }
  });
  
  const totalCustomers = Math.max(0, customers.length - 1); // Exclude Walk-in Customer
  const avgBillValue = totalBills > 0 ? Math.round(totalRevenue / totalBills) : 0;
  
  return {
    totalRevenue: totalRevenue,
    totalExpenses: totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    totalCustomers: totalCustomers,
    todayAppointments: todayAppointments,
    lowStockItems: lowStockItems,
    monthlyBookings: monthlyBookings,
    avgBillValue: avgBillValue
  };
}

/**
 * Generates Daily Sales Report groups for reports view.
 */
function getReportsHandler() {
  const sales = getSheetRows("Sales");
  
  // Group transactions by date
  const groups = {};
  sales.forEach(s => {
    const date = s.Date || "Unknown";
    const amount = parseFloat(s.Total) || 0;
    
    if (!groups[date]) {
      groups[date] = {
        date: date,
        totalSales: 0,
        transactionCount: 0
      };
    }
    
    groups[date].totalSales += amount;
    groups[date].transactionCount += 1;
  });
  
  // Transform to sorted list and compute averages
  const reportList = Object.keys(groups).map(date => {
    const g = groups[date];
    g.avgValue = g.transactionCount > 0 ? Math.round(g.totalSales / g.transactionCount) : 0;
    return g;
  });
  
  // Sort descending by date
  reportList.sort((a, b) => b.date.localeCompare(a.date));
  
  return reportList;
}

/**
 * Deletes a row in a sheet matching keyField = keyValue.
 */
function deleteSheetRow(sheetName, keyField, keyValue) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found: " + sheetName);
  
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return false;
  
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const keyIndex = headers.indexOf(keyField);
  if (keyIndex === -1) throw new Error(`Key field '${keyField}' not found in headers.`);
  
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][keyIndex]) === String(keyValue)) {
      const rowIndex = i + 2; // 2 because 1-indexed and header row
      sheet.deleteRow(rowIndex);
      return true;
    }
  }
  return false;
}

/**
 * Deletes all items for a package ID.
 */
function deletePackageItemsByPackageId(packageId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName("PackageItems");
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const pkgIdIdx = headers.indexOf("PackageID");
  if (pkgIdIdx === -1) return;
  
  // Go backwards so index deletion doesn't shift remaining rows
  for (let i = lastRow; i >= 2; i--) {
    const val = sheet.getRange(i, pkgIdIdx + 1).getValue();
    if (String(val) === String(packageId)) {
      sheet.deleteRow(i);
    }
  }
}

/**
 * Adds a new Package and its corresponding PackageItems.
 */
function addPackageHandler(payload) {
  const packages = getSheetRows("Packages");
  
  // Calculate next Package ID
  let maxIdNum = 0;
  packages.forEach(p => {
    if (p.PackageID && p.PackageID.startsWith("PKG")) {
      const num = parseInt(p.PackageID.substring(3));
      if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
    }
  });
  const nextPackageId = "PKG" + String(maxIdNum + 1).padStart(3, '0');
  
  const newPkg = {
    PackageID: nextPackageId,
    Name: payload.name || "Unnamed Package",
    Price: parseFloat(payload.price) || 0,
    Description: payload.description || "",
    Status: payload.status || "Active"
  };
  
  appendSheetRow("Packages", newPkg);
  
  // Now add PackageItems
  const items = payload.items || [];
  const packageItems = getSheetRows("PackageItems");
  let maxItemIdNum = 0;
  packageItems.forEach(item => {
    if (item.PackageItemID && item.PackageItemID.startsWith("PKGI")) {
      const num = parseInt(item.PackageItemID.substring(4));
      if (!isNaN(num) && num > maxItemIdNum) maxItemIdNum = num;
    }
  });
  
  items.forEach((item, index) => {
    const nextItemId = "PKGI" + String(maxItemIdNum + index + 1).padStart(3, '0');
    const newPkgItem = {
      PackageItemID: nextItemId,
      PackageID: nextPackageId,
      ServiceID: item.ServiceID,
      OriginalPrice: parseFloat(item.OriginalPrice) || 0,
      DiscountPercent: parseFloat(item.DiscountPercent) || 0,
      DiscountAmount: parseFloat(item.DiscountAmount) || 0,
      FinalPrice: parseFloat(item.FinalPrice) || 0
    };
    appendSheetRow("PackageItems", newPkgItem);
  });
  
  return newPkg;
}

/**
 * Updates an existing Package and replaces its corresponding PackageItems.
 */
function updatePackageHandler(payload) {
  const packageId = payload.PackageID;
  if (!packageId) throw new Error("Missing PackageID for update operation.");
  
  const updatedPkg = {
    Name: payload.name,
    Price: parseFloat(payload.price) || 0,
    Description: payload.description || "",
    Status: payload.status || "Active"
  };
  
  const success = updateSheetRow("Packages", "PackageID", packageId, updatedPkg);
  if (!success) {
    throw new Error("Package ID not found: " + packageId);
  }
  
  // Re-create PackageItems: first delete old items, then add new ones
  deletePackageItemsByPackageId(packageId);
  
  const items = payload.items || [];
  const packageItems = getSheetRows("PackageItems");
  let maxItemIdNum = 0;
  packageItems.forEach(item => {
    if (item.PackageItemID && item.PackageItemID.startsWith("PKGI")) {
      const num = parseInt(item.PackageItemID.substring(4));
      if (!isNaN(num) && num > maxItemIdNum) maxItemIdNum = num;
    }
  });
  
  items.forEach((item, index) => {
    const nextItemId = "PKGI" + String(maxItemIdNum + index + 1).padStart(3, '0');
    const newPkgItem = {
      PackageItemID: nextItemId,
      PackageID: packageId,
      ServiceID: item.ServiceID,
      OriginalPrice: parseFloat(item.OriginalPrice) || 0,
      DiscountPercent: parseFloat(item.DiscountPercent) || 0,
      DiscountAmount: parseFloat(item.DiscountAmount) || 0,
      FinalPrice: parseFloat(item.FinalPrice) || 0
    };
    appendSheetRow("PackageItems", newPkgItem);
  });
  
  return { PackageID: packageId, ...updatedPkg };
}

/**
 * Deletes a Package and all of its PackageItems.
 */
function deletePackageHandler(payload) {
  const packageId = payload.PackageID;
  if (!packageId) throw new Error("Missing PackageID for delete operation.");
  
  const success = deleteSheetRow("Packages", "PackageID", packageId);
  if (!success) {
    throw new Error("Package ID not found for deletion: " + packageId);
  }
  
  deletePackageItemsByPackageId(packageId);
  return { success: true, PackageID: packageId };
}
