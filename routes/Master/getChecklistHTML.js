const getChecklistHTML = ({
  reportNo,
  date,
  customer,
  machine,
  checklistItems,
  serviceEngineer,
  remarkglobal,
  formatChlNo,
  formatRevNo,
}) => {
  const maxRows = 22;
  const displayedItems = checklistItems.slice(0, maxRows);

  const itemRows = displayedItems
    .map((item, index) => {
      return `
        <tr>
          <td class="cell center">${index + 1}</td>
          <td class="cell">${item.checkpoint}</td>
          <td class="cell center">${item.result}</td>
          <td class="cell">${item.remark || ""}</td>
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

        .signature-box {
          border: 1.5px solid #000;
          padding-left: 8px;
          font-size: 13px;
        }

        .signature-box img {
          width: 50px;
          margin-top: -60px;
          margin-left: 70px;
        }

        .section-title {
          font-weight: bold;
          font-size: 13px;
        }

        .checklist-header th {
          font-size: 16px;
          padding: 5px;
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
                  <td style="border-bottom: 1px solid black; font-weight: bold; height: 50px; font-size: 13px;">
                    Format No &amp; Revision: ${formatChlNo}-${formatRevNo}
                  </td>
                </tr>
                <tr>
                  <td style="font-weight: bold; font-size: 13px;">
                    Document reference no <br />&amp; Revision:
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
            <td class="cell">${reportNo || ""}</td>
            <td class="cell section-title">Date:</td>
            <td class="cell">${date || "DD/MM/YYYY"}</td>
          </tr>
          <tr>
            <td class="cell section-title">Customer Code:</td>
            <td class="cell">${customer?.customercodeid || ""}</td>
            <td class="cell section-title">Name:</td>
            <td class="cell">${customer?.hospitalname || ""}</td>
          </tr>
          <tr>
            <td class="cell section-title">Address:</td>
            <td class="cell">${customer?.street || ""}, ${customer?.city || ""}</td>
            <td class="cell section-title">Telephone:</td>
            <td class="cell">${customer?.telephone || ""}</td>
          </tr>
          <tr>
            <td class="cell section-title">Email:</td>
            <td class="cell">${customer?.email || ""}</td>
            <td class="cell section-title">Doc No:</td>
            <td class="cell"></td>
          </tr>
          <tr>
            <td class="cell section-title">Part Number:</td>
            <td class="cell">${machine?.partNumber || ""}</td>
            <td class="cell section-title">Machine ID:</td>
            <td class="cell">${machine?.machineId || ""}</td>
          </tr>
          <tr>
            <td class="cell section-title">Model Description:</td>
            <td class="cell">${machine?.modelDescription || ""}</td>
            <td class="cell section-title">Serial Number:</td>
            <td class="cell">${machine?.serialNumber || ""}</td>
          </tr>
        </table>

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
            <td class="cell center" style="width: 20%;"><strong>Remarks:</strong></td>
            <td colspan="2" class="cell center">${remarkglobal}</td>
          </tr>
          <tr>
            <td class="cell center" style="width: 20%;"><strong>Service Engineer Name:</strong></td>
            <td class="cell" style="width: 40%;"><strong>${serviceEngineer || ""}</strong></td>
            <td class="signature-box">
              <p style="font-weight: bold; margin: 0">Signature valid</p>
              <div>
                Digitally signed by <br />
                SKANRAY TECHNOLOGIES LIMITED <br />
                P1 ${date || ""}
              </div>
              <img src="https://www.iconpacks.net/icons/2/free-check-icon-3278-thumb.png" alt="Signature Check" />
            </td>
          </tr>
        </table>
      </div>
    </body>
  </html>
  `;
};

module.exports = { getChecklistHTML };
