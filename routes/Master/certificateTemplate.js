module.exports = function getCertificateHTML(data) {
  const {
    userInfo = {},
    dateOfInstallation = "",
    customerId = "",
    customerName = "",
    hospitalName = "",
    phoneNumber = "",
    email = "",
    city = "",
    street = "",
    postalCode = "",
    state = "",
    abnormalCondition = "",
    voltageData = {},
    otp = "",
    palnumber = "",
    installationreportno = "",

    // The array for the equipment lines
    equipmentList = [],

    // For "Installed by" section
    firstName = userInfo.firstName || "",
    lastName = userInfo.lastName || "",
    employeeId = userInfo.employeeId || "",
    dealerCode = userInfo.dealerCode || "",
  } = data;

  // Destructure your voltageData object
  const { lnry = "", lgyb = "", ngbr = "" } = voltageData;

  // Build up to 5 rows for equipment - UPDATED VERSION with key in brackets and centered
  function generateEquipmentRows(items) {
    let rowsHtml = "";
    for (let i = 0; i < 5; i++) {
      if (i < items.length) {
        const eq = items[i];

        // FIXED: Ensure key is treated as string to avoid scientific notation
        const keyStr = eq.key ? String(eq.key) : "";

        // Create equipment description with material code below
        const equipmentDescWithCode = `
        ${eq.materialdescription || ""}<br />
        <span style="font-size: 10px; color: #666;">${eq.materialcode || ""}</span>
      `;

        // Create serial number with key in brackets and centered below
        const serialWithKeyBelow = keyStr ?
          `${eq.serialnumber || ""}<br /><div style="text-align: center; font-size: 10px; color: #666;">(${keyStr})</div>` :
          eq.serialnumber || "";

        console.log('Equipment Key Debug:', {
          originalKey: eq.key,
          keyStr: keyStr,
          serialWithKeyBelow: serialWithKeyBelow
        });

        rowsHtml += `
        <tr>
          <td class="field-data">${i + 1}</td>
          <td colspan="2" class="field-data">${equipmentDescWithCode}</td>
          <td colspan="2" class="field-data">${serialWithKeyBelow}</td>
          <td colspan="2" class="field-data">${eq.custWarrantyenddate
            ? new Date(eq.custWarrantyenddate).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
            : ""
          }</td>
        </tr>
      `;
      } else {
        // Blank row
        rowsHtml += `
        <tr>
          <td class="field-data">${i + 1}</td>
          <td colspan="2" class="field-data"></td>
          <td colspan="2" class="field-data"></td>
          <td colspan="2" class="field-data"></td>
        </tr>
      `;
      }
    }
    return rowsHtml;
  }



  const equipmentRows = generateEquipmentRows(equipmentList);

  // Determine what to show in "Installed by" section based on usertype
  let installedBySection = "";
  if (userInfo.usertype === "skanray") {
    // For Skanray users, show state names instead of dealer code
    const stateNamesText = userInfo.stateNames ? userInfo.stateNames.join(", ") : "";
    installedBySection = `
      <span class="install-label">Installed by:</span> <span class="install-data">${employeeId}</span><br />
      <span class="install-label">Engineer:</span> <span class="install-data">${firstName} ${lastName}</span><br />
      <span class="install-label">States:</span> <span class="install-data">${stateNamesText}</span>
    `;
  } else {
    // For dealer users, show dealer code (existing logic)
    installedBySection = `
      <span class="install-label">Installed by:</span> <span class="install-data">${employeeId}</span><br />
      <span class="install-label">Engineer:</span> <span class="install-data">${firstName} ${lastName}</span><br />
      <span class="install-label">Dealer:</span> <span class="install-data">${dealerCode}</span>
    `;
  }

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Installation Report & Warranty Certificate</title>
    <style>
      @page {
        size: A4;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 5;
        font-family: sans-serif;
      }
      .main-container {
        width: 100%;
        border: 2px solid rgb(198, 3, 3);
        box-sizing: border-box;
        margin: 10px auto;
        padding: 10px;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        font-size: 16px;
        margin-bottom: 10px;
      }
      h1 {
        font-size: 28px;
        margin: 0;
        padding: 0;
        line-height: 1.2;
      }
      .sub-title {
        font-size: 20px;
        line-height: 1.2;
      }
      td {
        border: 1.5px solid #000;
        padding: 6px;
      }
      h1, h2, h3, p {
        margin: 0;
        padding: 0;
      }
      .disclaimer-box {
        border: 1.5px solid #000;
        padding: 15px;
        font-size: 19px;
        line-height: 1.5;
        font-weight: bold;
        margin-bottom: 10px;
      }
      .no-border td {
        border: none !important;
      }
      .page-break {
        page-break-before: always;
      }
      .warranty-text {
        font-size: 19px;
        line-height: 1.5;
        margin-bottom: 20px;
      }
      ol.warranty-list {
        font-size: 19px;
        line-height: 1.5;
        margin-left: 40px;
        margin-bottom: 20px;
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

      /* Table header labels */
      .table-header {
        font-family: Arial, sans-serif;
        font-size: 9.5px;
        font-weight: bold;
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

    <!-- PAGE 1 -->
    <div class="main-container">
      <!-- Header -->
      <table class="no-border" style="margin-bottom: 0;">
        <tr>
          <td style="width: 90px; vertical-align: middle; text-align: left; border: none;">
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRXw9vrbn9kBdgshQc4BipXz7u0XR6Zd4hwgg&s"
              alt="Skanray Logo"
              style="width: 80px; height: auto; display: block;"
            />
          </td>
          <td style="vertical-align: middle; text-align: left; border: none;">
             <h1 style="text-align: center; margin-bottom: 15px; font-size: 25px;">
        Skanray Technologies Limited
      </h1>
      <h2 style="text-align: center; margin-bottom: 30px; font-size: 23px;">
        Installation Report &amp; Warranty Certificate
      </h2>
          </td>
        </tr>
      </table>

      <!-- First table: Installation/Customer details -->
      <table>
        <tr>
          <td>
            <span class="field-label">Date of Installation:</span>
            <span class="field-data">${dateOfInstallation}</span>
          </td>
          <td class="field-label">Installation Report #</td>
          <td class="field-data">${installationreportno}</td>
        </tr>
        <tr>
          <td colspan="3">
            <span class="field-label">Customer Details:</span> 
            <span class="field-data">${customerId}</span>
          </td>
        </tr>
        <tr>
          <td>
            <span class="field-label">Name :</span>
            <span class="field-data">${customerName || "NA"}</span>
          </td>
          <td class="field-label">Hospital Name:</td>
          <td class="field-data">${hospitalName || "NA"}</td>
        </tr>

        <tr>
          <td>
            <span class="field-label">Address 1 :</span> 
            <span class="field-data">${street}</span>
          </td>
          <td class="field-label">Telephone</td>
          <td class="field-data">${phoneNumber}</td>
        </tr>
        <tr>
          <td class="field-label">Address 2 :</td>
          <td class="field-label">Email :</td>
          <td class="field-data">${email}</td>
        </tr>
        <tr>
          <td>
            <span class="field-label">City :</span> 
            <span class="field-data">${city}</span>
          </td>
          <td>
            <span class="field-label">Pin Code :</span> 
            <span class="field-data">${postalCode}</span>
          </td>
          <td>
            <span class="field-label">State :</span> 
            <span class="field-data">${state}</span>
          </td>
        </tr>
         <td colspan="3" class="field-label">AERB APP No.For X-Ray Equipments only: </td>
      </table>

      <!-- Second table: Equipment & Warranty -->
      <table>
        <tr>
          <td style="width: 8%" class="table-header">S.No.</td>
          <td colspan="2" class="table-header">Equipment Description</td>
          <td colspan="2" class="table-header">Serial Number</td>
          <td colspan="2" class="table-header">Warranty End</td>
        </tr>

        ${equipmentRows}

        <tr>
          <td colspan="7" style="text-align: center; font-weight: bold; padding: 10px 0;" class="field-label">
            Site Conditions
          </td>
        </tr>
        <tr>
          <td colspan="7" style="padding: 10px 0;">
            <span class="field-label">Any abnormal site conditions:</span> 
            <span class="field-data">${abnormalCondition}</span>
          </td>
        </tr>
        <tr>
          <td class="field-label">Supply Voltage(V)</td>
          <td class="field-label">L-N/R-Y</td>
          <td class="field-data">${lnry}</td>
          <td class="field-label">L-G/Y-B</td>
          <td class="field-data">${lgyb}</td>
          <td class="field-label">N-G/B-R</td>
          <td class="field-data">${ngbr}</td>
        </tr>
      </table>

      <!-- Disclaimer box -->
      <div class="disclaimer-box">
        <p style="margin: 0 0 15px;">
          The above equipment has been installed, trained for usage &amp;
          maintenance, and handed over to the customer in good working
          condition.
        </p>
        <p style="margin: 0;">
          Customer shall operate any Radiology equipment(s) only after
          completion of onsite QA test. Skanray is not liable for any
          radiation-related hazard arising from operating the unit prior to
          completion of QA test.
        </p>
      </div>

      <!-- Signature Section -->
      <table style="font-size: 16px;">
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
            ${installedBySection}
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
            <span class="install-label">Digitally Authorised by</span> <span class="install-data">${customerName} / ${hospitalName}</span> <br />
            <span class="install-label">by providing (OTP</span> <span class="install-data">${otp}</span> <span class="install-label">sent on</span> <span class="install-data">${dateOfInstallation}</span><span class="install-label">) to</span>
            <strong class="install-data">${email}</strong> <span class="install-label">and</span>
            <strong class="install-data">${phoneNumber}</strong> <span class="install-label">by Skanray</span>
          </td>
          <td style="border: 1.5px solid #000; padding: 8px; width: 30%;">
            <p style="font-weight: bold; margin: 0;">Signature valid</p>
            <div style="font-size: 16px;">
              Digitally signed by <br />
              SKANRAY TECHNOLOGIES LIMITED <br />
              P1 ${dateOfInstallation}
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

    <!-- PAGE 2 -->
    <div class="page-break"></div>
    <div class="main-container">
      <h1 style="text-align: center; margin-bottom: 15px; font-size: 25px;">
        Skanray Technologies Limited
      </h1>
      <h2 style="text-align: center; margin-bottom: 30px; font-size: 23px;">
        Installation Report &amp; Warranty Certificate
      </h2>

      <p class="warranty-text">
        Skanray warrants its medical equipment(s) against only manufacturing
        defects for a period as indicated in this report no (${installationreportno || "N/A"
    }) Dated (${dateOfInstallation}).
      </p>
      <p class="warranty-text">
        Warranty for all accessories 6 Months only unless specified otherwise by
        a separate document from Skanray.
      </p>
      <p class="warranty-text">
        During the warranty period, Skanray will, at its option, either repair
        or replace the defective components / assemblies free of charge. The
        defective part shall be promptly packed to Skanray's concerned
        office/service center in properly sealed packing freight, insurance
        and forwarding charges. Other claims, partially for compensation, are
        excluded.
      </p>
      <p class="warranty-text">
        Skanray's standard terms of sale and installation and repairs are
        carried out by Skanray's Engineer or Authorised Service Franchisee.
      </p>
      <p class="warranty-text">
        The warranty does not cover the following:
      </p>
      <ol class="warranty-list">
        <li>Normal maintenance / misuse / mishandling of the equipment</li>
        <li>Damage caused due to rough / improper usage of the product</li>
        <li>Entry of insects, rodents, ants, cockroaches etc.</li>
        <li>Improper site conditions and installation</li>
        <li>
          Damage to the equipment by external agencies (e.g. Accidents,
          vibrations etc.)
        </li>
        <li>The power supply arrangement to the machine</li>
      </ol>
      <p class="warranty-text">
        Battery or similar consumable items are not covered under warranty.
        Spares are excluded from warranty if damaged due to the above reasons.
      </p>
      <p class="warranty-text">
        Equipment shall not be used for any other purpose than its intended
        design or nature. This warranty shall not apply to defects resulting
        from any attempt by any person other than Skanray's personnel or
        authorised agent to adjust, modify, or repair the product.
      </p>
      <p class="warranty-text" style="margin-bottom: 0;">
        Skanray Technologies Limited<br />
        # 15-17, Hebbal Industrial Area<br />
        Mysore - 570 016 | Karnataka | INDIA<br />
        Phone: +91 821 3988444 Fax: +91 821 2403344<br />
        E-mail: ciz@skanray.com<br />
        Toll Free No.: 1800-425-2007
      </p>
    </div>
  </body>
</html>
  `;
};
