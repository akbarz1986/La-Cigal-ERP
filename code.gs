/**
 * code.gs
 * La Cigal Salon & Spa ERP - Web App Entry Point
 * 
 * Handles incoming HTTP requests and dispatches them to appropriate API handlers.
 */

// Enable CORS for web app requests
function handleCors(output) {
  return output.setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle HTTP GET Requests (useful for simple diagnostics or testing)
 */
function doGet(e) {
  const result = {
    status: "success",
    message: "La Cigal ERP Web App is running. Use POST requests for API actions."
  };
  return handleCors(ContentService.createTextOutput(JSON.stringify(result)));
}

/**
 * Handle HTTP OPTIONS Requests (pre-flight checks for CORS)
 */
function doOptions(e) {
  const output = ContentService.createTextOutput("");
  return handleCors(output);
}

/**
 * Handle HTTP POST Requests (dispatches all actions)
 */
function doPost(e) {
  try {
    // Parse incoming request parameters
    let jsonString = "";
    if (e.postData && e.postData.contents) {
      jsonString = e.postData.contents;
    } else if (e.parameter && e.parameter.data) {
      jsonString = e.parameter.data;
    } else {
      throw new Error("No payload found in the request.");
    }
    
    const request = JSON.parse(jsonString);
    const action = request.action;
    const payload = request.payload || {};
    const user = request.user || "System";
    
    if (!action) {
      throw new Error("Missing 'action' parameter.");
    }
    
    // Dispatch action to API handlers in API.gs
    const responseData = dispatchAction(action, payload, user);
    
    const result = {
      status: "success",
      data: responseData
    };
    
    return handleCors(ContentService.createTextOutput(JSON.stringify(result)));
    
  } catch (error) {
    Logger.log("API Error: " + error.toString());
    const result = {
      status: "error",
      message: error.toString()
    };
    return handleCors(ContentService.createTextOutput(JSON.stringify(result)));
  }
}
