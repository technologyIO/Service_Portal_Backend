const getChecklistHTMLPM = ({
  reportNo,
  date,
  customer,
  city,
  machine,          // e.g. { partNumber, modelDescription, serialNumber, machineId, etc. }
  checklistItems,   // array of { checkpoint, result, remark }
  serviceEngineer,
  remarkglobal,
  formatChlNo,
  pmType,
  formatRevNo,
}) => {
  // 1) Decide how many total rows we want on one page
  const maxRows = 14;

  // 2) Take up to 'maxRows' items from the array
  const displayedItems = checklistItems.slice(0, maxRows);

  // 3) Build table rows for each checklist item
  const itemRows = displayedItems.map((item, index) => {
    return `
          <tr>
            <td style="border: 1px solid black; padding: 5px; text-align:center">${index + 1}</td>
            <td style="border: 1px solid black; padding: 5px;">${item.checkpoint}</td>
            <td style="border: 1px solid black; padding: 5px; text-align:center">${item.result}</td>
            <td style="border: 1px solid black; padding: 5px;">${item.remark || ""}</td>
          </tr>
        `;
  });

  // 4) If we have fewer than maxRows items, fill the rest with blank rows
  const blankRowsNeeded = maxRows - displayedItems.length;
  const blankRows = [];
  for (let i = 0; i < blankRowsNeeded; i++) {
    blankRows.push(`
          <tr>
            <td style="border: 1px solid black; padding: 5px; height: 15px; text-align:center"></td>
            <td style="border: 1px solid black; padding: 5px;"></td>
            <td style="border: 1px solid black; padding: 5px;"></td>
            <td style="border: 1px solid black; padding: 5px;"></td>
          </tr>
        `);
  }

  // 5) Combine data rows + blank rows
  const checklistRows = itemRows.join("") + blankRows.join("");

  // 6) Return the final HTML
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Preventive Maintenence Checklist</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 10px;">
        <div style="border: 2px solid red; margin: 10px; padding: 10px">
          <!-- Top Table with Logo + "Skanray Technologies Limited" + "Preventive Maintenence Checklist" together -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid black;">
            <tr>
              <!-- Logo cell -->
              <td
                style="
                  width: 13%;
                  text-align: center;
                  border-right: 1px solid black;
                  vertical-align: top;
                  padding: 5px;
                "
              >
                <img
                  src="https://skanray.com/wp-content/uploads/2024/07/Skanray-logo.png"
                  alt="Company Logo"
                  style="max-width: 60px; padding: 5px"
                />
              </td>
    
              <!-- Middle cell: Skanray name + Installation Checklist in one cell -->
              <td
                style="
                  text-align: center;
                  font-weight: bold;
                  font-size: 13px; /* Increased size */
                  border-bottom: 1px solid black;
                  padding: 5px;
                "
              >
                Skanray Technologies Limited
                <br />
                <span style="font-size: 12px;">Installation Checklist</span>
              </td>
    
              <!-- Right cell: Format No & Revision -->
              <td style="width: 30%; border: 1px solid black;">
                <table style="width: 100%; height: 100px; border-collapse: collapse;">
                  <tr>
                    <td style="border-bottom: 1px solid black; font-weight: bold; height: 40px; font-size: 8px;">
                      Format No &amp; Revision:${formatChlNo}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-weight: bold; font-size: 8px;">
                      Document reference no <br/>
                      &amp; Revision: ${formatRevNo}
                    </td> 
                  </tr>
                </table>
              </td>
            </tr>
          </table>
    
          <!-- Top Info Table -->
            <table
        style="width: 100%; border-collapse: collapse; border: 1px solid black"
      >
        <!-- Header Row: Report No, Date, PM Type, Hard Code -->
        <tr>
          <td
            style="
              width: 15%;
              font-weight: bold;
              border: 1px solid black;
              padding: 5px;
            "
          >
            Report No:
          </td>
          <td style="width: 15%; border: 1px solid black; padding: 5px">
            ${reportNo || ""}
          </td>

          <td
            style="
              width: 15%;
              font-weight: bold;
              border: 1px solid black;
              padding: 5px;
            "
          >
            Date:
          </td>
          <td style="width: 15%; border: 1px solid black; padding: 5px">
            ${date || "DD-MM-YYYY"}
          </td>

          <td
            style="
              width: 20%;
              font-weight: bold;
              border: 1px solid black;
              padding: 5px;
            "
          >
            PM Type:
          </td>
          <td style="width: 20%; border: 1px solid black; padding: 5px">
          ${pmType}
          </td>
        </tr>

        <!-- Customer Information Row (Left Side) -->
        <tr>
          <td
            colspan="3"
            style="border: 1px solid black; padding: 5px; text-align: left"
          >
            <strong>Customer Code:</strong> ${customer?.customercodeid || ""}
            <br />
            <strong>Name:</strong> ${customer?.hospitalname || ""} <br />
            <strong>Address:</strong> ${customer?.street || ""},
            <strong>City:</strong> ${city},
            
            <strong>Telephone:</strong> ${customer?.telephone || ""} <br />
            <strong>Email:</strong> ${customer?.email || ""} <br />
          </td>

          <!-- Machine Information Row (Right Side) -->
          <td colspan="3" style="border: 1px solid black; ">
            <table
              style="
                width: 100%;
                border-collapse: collapse;
                border: 0px solid black;
              "
            >
              <tr>
                <td
                  style="
                    font-weight: bold;
                    border: 0px solid black;
                    padding: 5px;
                    height: 20px;
                  "
                >
                  Part Number:
                </td>
                <td style="border: 0px solid black; padding: 5px">
                  ${machine?.partNumber || ""}
                </td>
              </tr>
              <tr>
                <td
                  style="
                    font-weight: bold;
                    border: 1px solid black;
                    padding: 5px;
                    height: 20px;
                  "
                >
                  Model Description:
                </td>
                <td style="border: 1px solid black; padding: 5px">
                  ${machine?.modelDescription || ""}
                </td>
              </tr>
              <tr>
                <td
                  style="
                    font-weight: bold;
                    /* border: 1px solid black; */
                    padding: 5px;
                    height: 20px;
                  "
                >
                  Serial Number:
                </td>
                <td style="border: 0px solid black; padding: 5px">
                  ${machine?.serialNumber || ""}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    
          <!-- Checklist Table -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid black;">
            <tr>
              <th style="width: 10%; border: 1px solid black; padding: 5px; text-align: center; font-size:11px;">
                Sl. No
              </th>
              <th style="width: 50%; border: 1px solid black; padding: 5px; text-align: center; font-size:11px;">
                Description
              </th>
              <th style="width: 20%; border: 1px solid black; padding: 5px; text-align: center; font-size:11px;">
                Result
              </th>
              <th style="width: 20%; border: 1px solid black; padding: 5px; text-align: center; font-size:11px;">
                Remarks
              </th>
            </tr>
            ${checklistRows}
          </table>
    
          <!-- Bottom Remarks & Signature -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid black;">
            <tr style="height: 100px;">
              <td style="width: 20%; border: 1px solid black; padding: 5px; text-align: center;">
                <strong>Remarks:</strong>
              </td>
              <td colspan="2" style="border: 1px solid black; text-align: center;">
                ${remarkglobal}
              </td>
            </tr>
            <tr>
              <td style="width: 20%; border: 1px solid black; padding: 5px; text-align: center;">
                <strong>Service Engineer Name:</strong>
              </td>
              <td style="width: 40%; border: 1px solid black; padding: 5px">
                <strong>${serviceEngineer || ""}</strong>
              </td>
              <td style="border: 1.5px solid #000; padding: 0px 0px 0px 8px; width: 30%">
                <p style="font-weight: bold; margin: 0">Signature valid</p>
                <div style="font-size: 9px">
                  Digitally signed by <br />
                  SKANRAY TECHNOLOGIES LIMITED <br />
                  P1 ${date || ""}
                </div>
                <img
                  src="https://www.iconpacks.net/icons/2/free-check-icon-3278-thumb.png"
                  alt="Signature Check"
                  style="
                    width: 50px;
                    margin-top: -80px;
                    margin-left: 100px;
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

module.exports = { getChecklistHTMLPM };
