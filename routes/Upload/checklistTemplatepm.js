const getChecklistHTMLPM = ({
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
  const maxRows = 28;
  const displayedItems = checklistItems.slice(0, maxRows);

  const itemRows = displayedItems
    .map((item, index) => {
      return `
        <tr>
          <td style="border: 1px solid black; padding: 5px; text-align: center; font-size:11px;">${index + 1}</td>
          <td style="border: 1px solid black; padding: 5px; font-size:11px;">${item.checkpoint}</td>
          <td style="border: 1px solid black; padding: 5px; text-align: center; font-size:11px;">${item.result}</td>
          <td style="border: 1px solid black; padding: 5px; font-size:11px;">${item.remark || ""}</td>
        </tr>
      `;
    })
    .join("");

  const blankRows = Array.from({ length: maxRows - displayedItems.length }, () => {
    return `
      <tr>
        <td style="border: 1px solid black; padding: 5px; height: 17px;"></td>
        <td style="border: 1px solid black; padding: 5px;"></td>
        <td style="border: 1px solid black; padding: 5px;"></td>
        <td style="border: 1px solid black; padding: 5px;"></td>
      </tr>
    `;
  }).join("");

  const checklistRows = itemRows + blankRows;

  // Determine what to show in service engineer section based on usertype
  let serviceEngineerSection = "";
  if (userInfo?.usertype === "skanray") {
    // For Skanray users, show state names instead of dealer code
    const stateNamesText = userInfo.stateNames ? userInfo.stateNames.join(", ") : "";
    serviceEngineerSection = `
      <td style="width: 20%; border: 1px solid black; padding: 5px; text-align: center; font-size:11px;">
        <strong>Service Engineer ID:</strong>
      </td>
      <td style="width: 40%; border: 1px solid black; padding: 5px; font-size:11px;">
        <strong>${userInfo.employeeid || ""}</strong>
      </td>
      <td style="width: 20%; border: 1px solid black; padding: 5px; text-align: center; font-size:11px;">
        <strong>Service Engineer Name:</strong>
      </td>
      <td style="width: 20%; border: 1px solid black; padding: 5px; font-size:11px;">
        <strong>${serviceEngineer || ""}</strong>
      </td>
    </tr>
    <tr>
      <td style="width: 20%; border: 1px solid black; padding: 5px; text-align: center; font-size:11px;">
        <strong>Company:</strong>
      </td>
      <td style="width: 40%; border: 1px solid black; padding: 5px; font-size:11px;">
        <strong>Skanray Technologies Limited</strong>
      </td>
      <td style="width: 20%; border: 1px solid black; padding: 5px; text-align: center; font-size:11px;">
        <strong>States:</strong>
      </td>
      <td style="width: 20%; border: 1px solid black; padding: 5px; font-size:11px;">
        <strong>${stateNamesText}</strong>
      </td>
    `;
  } else {
    // For dealer users, show dealer code
    serviceEngineerSection = `
      <td style="width: 20%; border: 1px solid black; padding: 5px; text-align: center; font-size:11px;">
        <strong>Service Engineer ID:</strong>
      </td>
      <td style="width: 40%; border: 1px solid black; padding: 5px; font-size:11px;">
        <strong>${userInfo?.employeeid || ""}</strong>
      </td>
      <td style="width: 20%; border: 1px solid black; padding: 5px; text-align: center; font-size:11px;">
        <strong>Service Engineer Name:</strong>
      </td>
      <td style="width: 20%; border: 1px solid black; padding: 5px; font-size:11px;">
        <strong>${serviceEngineer || ""}</strong>
      </td>
    </tr>
    <tr>
      <td style="width: 20%; border: 1px solid black; padding: 5px; text-align: center; font-size:11px;">
        <strong>Company:</strong>
      </td>
      <td style="width: 40%; border: 1px solid black; padding: 5px; font-size:11px;">
        <strong>${userInfo?.dealerName || ""}</strong>
      </td>
      <td style="width: 20%; border: 1px solid black; padding: 5px; text-align: center; font-size:11px;">
        <strong>Dealer Code:</strong>
      </td>
      <td style="width: 20%; border: 1px solid black; padding: 5px; font-size:11px;">
        <strong>${userInfo?.dealerCode || ""}</strong>
      </td>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Preventive Maintenance Checklist</title>
        <style>
          @page {
            margin: 5mm;
          }
          body {
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
          .field-data {
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
                <span>Preventive Maintenance Checklist</span>
              </td>
              <td style="width: 30%; border: 1px solid black;">
                <table style="width: 100%; height: 100px;">
                  <tr>
                    <td style="border-bottom: 1px solid black; height: 50px;">
                      <span class="section-title">Format No &amp; Revision:</span> 
                      <span class="field-data">${formatChlNo || "N/A"} - ${formatRevNo || "N/A"}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span class="section-title">Document reference no <br />&amp; Revision:</span> 
                      <span class="field-data">${documentChlNo || "N/A"} - ${documentRevNo || "N/A"}</span>
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
              <td colspan="3" style="border: 1px solid black; text-align: center;">
                ${remarkglobal}
              </td>
            </tr>
            <tr>
              ${serviceEngineerSection}
            </tr>
            <tr>
              <td style="width: 20%; border: 1px solid black; padding: 5px; text-align: center;">
                <strong>Signature:</strong>
              </td>
              <td colspan="3" style="border: 1.5px solid #000; padding: 0px 0px 0px 8px; width: 30%">
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
