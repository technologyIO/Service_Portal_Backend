const getChecklistHTML = ({
  reportNo,
  date,
  customer,
  machine,
  checklistItems,
  customername,
  serviceEngineer,
  remarkglobal,
  documentChlNo,
  documentRevNo,
  formatChlNo,
  formatRevNo,
  // Add new parameters for service engineer details
  userInfo,
}) => {
  const maxRows = 23;
  const displayedItems = checklistItems.slice(0, maxRows);

  const itemRows = displayedItems
    .map((item, index) => {
      return `
        <tr>
          <td class="cell center field-data">${index + 1}</td>
          <td class="cell field-data">${item.checkpoint}</td>
          <td class="cell center field-data">${item.result}</td>
          <td class="cell field-data">${item.remark || ""}</td>
        </tr>
      `;
    })
    .join("");

  const blankRows = Array.from({ length: maxRows - displayedItems.length }, () => {
    return `
      <tr>
        <td class="cell" style="height: 17px;"></td>
        <td class="cell"></td>
        <td class="cell"></td>
        <td class="cell"></td>
      </tr>
    `;
  }).join("");

  const checklistRows = itemRows + blankRows;

  // Get equipment used serial number and calibration date from the first checklist item
  const equipmentUsedSerial = checklistItems[0]?.equipmentUsedSerial || "";
  const calibrationDueDate = checklistItems[0]?.calibrationDueDate || "";

  // Determine what to show in service engineer section based on usertype (same as certificate)
  let serviceEngineerSection = "";
  if (userInfo?.usertype === "skanray") {
    // For Skanray users, show state names instead of dealer code
    const stateNamesText = userInfo.stateNames ? userInfo.stateNames.join(", ") : "";
    serviceEngineerSection = `
      <span class="install-label">Installed by:</span> <span class="install-data">${userInfo.employeeid || ""}</span><br />
      <span class="install-label">Engineer:</span> <span class="install-data">${serviceEngineer || ""}</span><br />
      <span class="install-label"></span> <span class="install-data">Skanray Technologies Limited</span><br />
      <span class="install-label">States:</span> <span class="install-data">${stateNamesText}</span>
    `;
  } else {
    // For dealer users, show dealer code
    serviceEngineerSection = `
      <span class="install-label">Installed by:</span> <span class="install-data">${userInfo?.employeeid || ""}</span><br />
      <span class="install-label">Engineer:</span> <span class="install-data">${serviceEngineer || ""}</span><br />
      <span class="install-label"></span> <span class="install-data">${userInfo?.dealerName || ""}</span><br />
      <span class="install-label">Dealer:</span> <span class="install-data">${userInfo?.dealerCode || ""}</span>
    `;
  }

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>Installation Checklist</title>
      <style>
        @page {
          margin:5mm;
        }

        * {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          font-size: 13px;
        }

        .wrapper {
          border: 2px solid red;
          padding: 3;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        .cell {
          border: 1px solid black;
          padding: 5px;
        }

        .center {
          text-align: center;
        }

        /* Field Labels - Arial 9.5px */
        .field-label {
          font-family: Arial, sans-serif;
          font-size: 9.5px;
          font-weight: bold;
        }

        /* Field Data - Calibri 11px */
        .field-data {
          font-family: Calibri, sans-serif;
          font-size: 11px;
        }

        .header-title {
          text-align: center;
          font-weight: bold;
          font-size: 19px;
          border-bottom: 1px solid black;
          padding: 5px;
        }

        .logo {
          max-width: 60px;
          padding: 5px;
        }

        .section-title {
          font-family: Arial, sans-serif;
          font-size: 9.5px;
          font-weight: bold;
        }

        .checklist-header th {
          font-family: Arial, sans-serif;
          font-size: 9.5px;
          font-weight: bold;
          padding: 5px;
        }

        .equipment-used-table {
          border: 1px solid #000; 
          width: 100%; 
          font-family: Arial, sans-serif; 
          font-size: 9.5px;
          margin-bottom: 10px;
        }
        
        .equipment-used-header {
          padding: 4px; 
          font-weight: bold; 
          border-bottom: 1px solid #000;
          font-family: Arial, sans-serif;
          font-size: 9.5px;
        }
        
        .equipment-used-row {
          display: flex;
        }
        
        .equipment-used-cell {
          padding: 6px;
        }
        
        .equipment-used-label {
          flex: 1; 
          border-right: 1px solid #000;
          font-family: Arial, sans-serif;
          font-size: 9.5px;
          font-weight: bold;
        }

        .equipment-used-data {
          font-family: Calibri, sans-serif;
          font-size: 11px;
        }
        
        .cal-due-label {
          width: 150px; 
          border-right: 1px solid #000; 
          font-family: Arial, sans-serif;
          font-size: 9.5px;
          font-weight: bold;
        }

        /* Format and Document reference styling */
        .format-label {
          font-family: Arial, sans-serif;
          font-size: 9.5px;
          font-weight: bold;
        }

        .format-data {
          font-family: Calibri, sans-serif;
          font-size: 11px;
        }

        /* Remarks section styling */
        .remarks-label {
          font-family: Arial, sans-serif;
          font-size: 9.5px;
          font-weight: bold;
        }

        .remarks-data {
          font-family: Calibri, sans-serif;
          font-size: 11px;
        }

        /* Installation by section styling - same as certificate */
        .install-label {
          font-family: Arial, sans-serif;
          font-size: 9.5px;
          font-weight: bold;
        }

        .install-data {
          font-family: Calibri, sans-serif;
          font-size: 11px;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <!-- Header Section -->
        <table>
          <tr>
            <td style="width: 13%;" class="center cell">
              <img src="https://skanray.com/wp-content/uploads/2024/07/Skanray-logo.png" alt="Company Logo" class="logo" />
            </td>
            <td class="header-title">
              Skanray Technologies Limited<br />
              <span>Installation Checklist</span>
            </td>
            <td style="width: 30%; border: 1px solid black;">
              <table style="width: 100%; height: 100px;">
                <tr>
                  <td style="border-bottom: 1px solid black; height: 50px;">
                    <span class="format-label">Format No &amp; Revision:</span> 
                    <span class="format-data">${formatChlNo || "N/A"} - ${formatRevNo || "N/A"}</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <span class="format-label">Document reference no <br />&amp; Revision:</span> 
                    <span class="format-data">${documentChlNo || "N/A"} - ${documentRevNo || "N/A"}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Info Section -->
        <table>
          <tr>
            <td class="cell section-title">Report No:</td>
            <td class="cell field-data">${reportNo || ""}</td>
            <td class="cell section-title">Date:</td>
            <td class="cell field-data">${date || "DD/MM/YYYY"}</td>
          </tr>
        <tr>
  <td class="cell section-title">Customer Code:</td>
  <td class="cell field-data">${customer?.customercodeid || "NA"}</td>

  <td class="cell section-title">Hospital Name:</td>
  <td class="cell field-data">${customer?.hospitalname || "NA"}</td>
</tr>

          <tr>
             <td class="cell section-title">Customer Name:</td>
             <td class="cell field-data">${customer?.customername || "NA"}</td>
             <td class="cell"></td>
             <td class="cell"></td>
          </tr>
          <tr>
            <td class="cell section-title">Address:</td>
            <td class="cell field-data">${customer?.street || ""}, ${customer?.city || ""}</td>
            <td class="cell section-title">Telephone:</td>
            <td class="cell field-data">${customer?.telephone || ""}</td>
          </tr>
          <tr>
            <td class="cell section-title">Email:</td>
            <td class="cell field-data">${customer?.email || ""}</td>
              <td class="cell section-title">Part Number:</td>
            <td class="cell field-data">${machine?.partNumber || ""}</td>
          </tr>
          
          <tr>
            <td class="cell section-title">Model Description:</td>
            <td class="cell field-data">${machine?.modelDescription || ""}</td>
            <td class="cell section-title">Serial Number:</td>
            <td class="cell field-data">${machine?.serialNumber || ""}</td>
          </tr>
        </table>

        <!-- Equipment Used Section -->
        <div class="equipment-used-table">
          <div class="equipment-used-header">
            EQUIPMENT USED:
          </div>
          <div class="equipment-used-row">
            <div class="equipment-used-cell equipment-used-label">
              Digital Multi meter S/L# -->    ${equipmentUsedSerial || "(If used)"}
            </div>
             
            <div class="equipment-used-cell cal-due-label">
              Cal Due Date: ${calibrationDueDate || ""}
            </div>
             
          </div>
        </div>

        <!-- Checklist Table -->
        <table>
          <tr class="checklist-header">
            <th class="cell center" style="width: 10%;">Sl. No</th>
            <th class="cell center" style="width: 50%;">Description</th>
            <th class="cell center" style="width: 20%;">Result</th>
            <th class="cell center" style="width: 20%;">Remarks</th>
          </tr>
          ${checklistRows}
        </table>

        <!-- Bottom Remarks -->
        <table>
          <tr style="height: 60px;">
            <td class="cell center remarks-label" style="width: 20%;"><strong>Remarks:</strong></td>
            <td colspan="3" class="cell center remarks-data">${remarkglobal}</td>
          </tr>
        </table>

        <!-- Signature Section - Same design as certificate -->
        <table style="font-size: 16px; margin-top: 20px;">
          <tr>
            <td
              style="
                border: 1.5px solid #000;
                padding: 8px;
                width: 25%;
                vertical-align: top;
                font-weight: bold;
                font-size: 13px;
              "
            >
              ${serviceEngineerSection}
            </td>
            <td
              style="
                border: 1.5px solid #000;
                font-weight: bold;
                padding: 8px;
                width: 45%;
                vertical-align: top;
              "
            >
              <span class="install-label">Digitally Authorised by</span> <span class="install-data">${customer?.customername || ""} / ${customer?.hospitalname || ""}</span> <br />
              <span class="install-label">by providing (OTP sent on</span> <span class="install-data">${date || ""}</span><span class="install-label">) to</span>
              <strong class="install-data">${customer?.email || ""}</strong> <span class="install-label">and</span>
              <strong class="install-data">${customer?.telephone || ""}</strong> <span class="install-label">by Skanray</span>
            </td>
            <td style="border: 1.5px solid #000; padding: 8px; width: 30%;">
              <p style="font-weight: bold; margin: 0;">Signature valid</p>
              <div style="font-size: 12px;">
                Digitally signed by <br />
                SKANRAY TECHNOLOGIES LIMITED <br />
                P1 ${date || ""}
              </div>
              <img
                src="https://www.iconpacks.net/icons/2/free-check-icon-3278-thumb.png"
                alt="Signature Check"
                style="
                  width: 60px;
                  height: auto;
                  margin-top: -70px;
                  margin-left: 120px;
                "
              />
            </td>
          </tr>
        </table>
      </div>
    </body>
  </html>
  `;
};

module.exports = { getChecklistHTML };
