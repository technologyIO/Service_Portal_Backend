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
  // Add new parameters for signature section
  otp,
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

  let serviceEngineerSection = "";

  if (userInfo?.usertype === "skanray") {
    // ✅ Skanray users → Always show states (ignore branch)
    const statesArray = Array.isArray(userInfo.state) ? userInfo.state : [];
    const stateNamesText = statesArray.length > 0 ? statesArray.join(", ") : "N/A";

    serviceEngineerSection = `
    <div class="install-section">
      <div><strong>Installed by:</strong> (${userInfo.employeeid || ""})</div>
      <div>Engineer: ${userInfo.firstname || ""} ${userInfo.lastname || ""} </div>
      <div>Skanray Technologies Limited</div>
      <div>States: ${stateNamesText}</div>
    </div>
  `;
  } else {
    // ✅ Dealer users → show dealer info
    serviceEngineerSection = `
    <div class="install-section">
      <div><strong>Installed by:</strong></div>
      <div>Engineer: ${userInfo.firstname || ""} ${userInfo.lastname || ""} (${userInfo.employeeid || ""})</div>
      <div>Dealer: ${userInfo.dealerName || "N/A"} (${userInfo.dealerCode || "N/A"})</div>
    </div>
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
          /* Installation by section styling */
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

          <!-- Bottom Remarks Section (moved up) -->
          <table style="width: 100%; border-collapse: collapse; border: 1px solid black; margin-top: 10px;">
            <tr style="height: 80px;">
              <td style="width: 20%; border: 1px solid black; padding: 5px; text-align: center; vertical-align: top;">
                <strong>Remarks:</strong>
              </td>
              <td colspan="3" style="border: 1px solid black; padding: 5px; vertical-align: top;">
                ${remarkglobal || ""}
              </td>
            </tr>
          </table>

          <!-- New Signature Section -->
          <table style="font-size: 16px; margin-top: 15px; width: 100%; border-collapse: collapse;">
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
                <span class="install-label">Digitally Authorised by</span> <span class="install-data">${customer?.customername || "NA"} / ${customer?.hospitalname || "NA"}</span> <br />
                <span class="install-label">by providing (OTP</span> <span class="install-data">${otp || ""}</span> <span class="install-label">sent on</span> <span class="install-data">${date || ""}</span><span class="install-label">) to</span>
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

module.exports = { getChecklistHTMLPM };
