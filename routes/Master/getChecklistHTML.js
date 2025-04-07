const getChecklistHTML = ({
  reportNo,
  date,
  customer,
  machine,          // e.g. { partNumber, modelDescription, serialNumber, machineId, etc. }
  checklistItems,   // array of { checkpoint, result, remark }
  serviceEngineer,
  remarkglobal,
  formatChlNo,  
  formatRevNo,
}) => {
  // 1) Decide how many total rows we want on one page
  const maxRows = 24;

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
          <td style="border: 1px solid black; padding: 5px; height: 30px; text-align:center"></td>
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
      <title>Installation Checklist</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 16px;">
      <div style="border: 2px solid red; margin: 20px; padding: 20px">
        <!-- Top Table with Logo + "Skanray Technologies Limited" + "Installation Checklist" together -->
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
                font-size: 20px; /* Increased size */
                border-bottom: 1px solid black;
                padding: 5px;
              "
            >
              Skanray Technologies Limited
              <br />
              <span style="font-size: 18px;">Installation Checklist</span>
            </td>
  
            <!-- Right cell: Format No & Revision -->
            <td style="width: 30%; border: 1px solid black;">
              <table style="width: 100%; height: 100px; border-collapse: collapse;">
                <tr>
                  <td style="border-bottom: 1px solid black; font-weight: bold; height: 50px;">
                    Format No &amp; Revision:${formatChlNo}-${formatRevNo}
                  </td>
                </tr>
                <tr>
                  <td style="font-weight: bold">
                    Document reference no <br/>
                    &amp; Revision:
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
  
        <!-- Top Info Table -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid black;">
          <tr>
            <td style="width: 25%; font-weight: bold; border: 1px solid black; padding: 5px;">Report No:</td>
            <td style="width: 25%; border: 1px solid black; padding: 5px;">${reportNo || ""}</td>
            <td style="width: 25%; font-weight: bold; border: 1px solid black; padding: 5px;">Date:</td>
            <td style="width: 25%; border: 1px solid black; padding: 5px;">${date || "DD/MM/YYYY"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; border: 1px solid black; padding: 5px">Customer Code:</td>
            <td style="border: 1px solid black; padding: 5px">${customer?.customercodeid || ""}</td>
            <td style="font-weight: bold; border: 1px solid black; padding: 5px">Name:</td>
            <td style="border: 1px solid black; padding: 5px">${customer?.hospitalname || ""}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; border: 1px solid black; padding: 5px">Address:</td>
            <td style="border: 1px solid black; padding: 5px">
              ${customer?.street || ""}, ${customer?.city || ""}
            </td>
            <td style="font-weight: bold; border: 1px solid black; padding: 5px">Telephone:</td>
            <td style="border: 1px solid black; padding: 5px">${customer?.telephone || ""}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; border: 1px solid black; padding: 5px">Email:</td>
            <td style="border: 1px solid black; padding: 5px">${customer?.email || ""}</td>
            <td style="font-weight: bold; border: 1px solid black; padding: 5px">Doc No:</td>
            <td style="border: 1px solid black; padding: 5px"></td>
          </tr>
          <tr>
            <td style="font-weight: bold; border: 1px solid black; padding: 5px">Part Number:</td>
            <td style="border: 1px solid black; padding: 5px">${machine?.partNumber || ""}</td>
            <td style="font-weight: bold; border: 1px solid black; padding: 5px">Machine ID:</td>
            <td style="border: 1px solid black; padding: 5px">${machine?.machineId || ""}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; border: 1px solid black; padding: 5px">Model Description:</td>
            <td style="border: 1px solid black; padding: 5px">${machine?.modelDescription || ""}</td>
            <td style="font-weight: bold; border: 1px solid black; padding: 5px">Serial Number:</td>
            <td style="border: 1px solid black; padding: 5px">${machine?.serialNumber || ""}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; border: 1px solid black; padding: 5px">Document Reference No:</td>
            <td style="border: 1px solid black; padding: 5px"></td>
            <td style="font-weight: bold; border: 1px solid black; padding: 5px">Revision #:</td>
            <td style="border: 1px solid black; padding: 5px"></td>
          </tr>
          
        </table>
  
        <!-- Checklist Table -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid black;">
          <tr>
            <th style="width: 10%; border: 1px solid black; padding: 5px; text-align: center; font-size:16px;">
              Sl. No
            </th>
            <th style="width: 50%; border: 1px solid black; padding: 5px; text-align: center; font-size:16px;">
              Description
            </th>
            <th style="width: 20%; border: 1px solid black; padding: 5px; text-align: center; font-size:16px;">
              Result
            </th>
            <th style="width: 20%; border: 1px solid black; padding: 5px; text-align: center; font-size:16px;">
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
              <div style="font-size: 12px">
                Digitally signed by <br />
                SKANRAY TECHNOLOGIES LIMITED <br />
                P1 ${date || ""}
              </div>
              <img
                src="https://www.iconpacks.net/icons/2/free-check-icon-3278-thumb.png"
                alt="Signature Check"
                style="
                  width: 60px;
                  margin-top: -80px;
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
