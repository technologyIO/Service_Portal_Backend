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
    // Rename to match what your front-end sends
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

  // Build up to 6 rows for equipment
  function generateEquipmentRows(items) {
    let rowsHtml = "";
    for (let i = 0; i < 5; i++) {
      if (i < items.length) {
        const eq = items[i];
        rowsHtml += `
          <tr>
            <td>${i + 1}</td>
            <td colspan="2">${eq.materialdescription || ""}</td>
            <td colspan="2">${eq.serialnumber || ""}</td>
            <td colspan="2">${eq.custWarrantyenddate
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
            <td>${i + 1}</td>
            <td colspan="2"></td>
            <td colspan="2"></td>
            <td colspan="2"></td>
          </tr>
        `;
      }
    }
    return rowsHtml;
  }

  const equipmentRows = generateEquipmentRows(equipmentList);

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
            Date of Installation:
            ${dateOfInstallation}
          </td>
          <td>Installation Report #</td>
          <td>${installationreportno}</td>
        </tr>
        <tr>
          <td colspan="3">Customer Details: ${customerId}</td>
        </tr>
        <tr>
  <td>Name :<span style=" font-size: 13px;"> ${customerName || "NA"}</span></td>
  <td>Hospital Name:</td>
  <td>${hospitalName || "NA"}</td>
</tr>

        <tr>
          <td>Address 1 : ${street}</td>
          <td>Telephone</td>
          <td>${phoneNumber}</td>
        </tr>
        <tr>
          <td>Address 2 :</td>
          <td>Email :</td>
          <td>${email}</td>
        </tr>
        <tr>
          <td>City : ${city}</td>
          <td>Pin Code : ${postalCode}</td>
          <td>State : ${state}</td>
        </tr>
         <tr>
          <td colspan="3">AERB APP No.For X-Ray Equipments only: ${aerbAppNo || "NA"}</td>
        </tr>
        
      </table>

      <!-- Second table: Equipment & Warranty -->
      <table>
        <tr>
          <td style="width: 8%">S.No.</td>
          <td colspan="2">Equipment Description</td>
          <td colspan="2">Serial Number</td>
          <td colspan="2">Warranty End</td>
        </tr>

        ${equipmentRows}

        <tr>
          <td colspan="7" style="text-align: center; font-weight: bold; padding: 10px 0;">
            Site Conditions
          </td>
        </tr>
        <tr>
          <td colspan="7" style="padding: 10px 0;">
            Any abnormal site conditions: ${abnormalCondition}
          </td>
        </tr>
        <tr>
          <td>Supply Voltage(V)</td>
          <td>L-N/R-Y</td>
          <td>${lnry}</td>
          <td>L-G/Y-B</td>
          <td>${lgyb}</td>
          <td>N-G/B-R</td>
          <td>${ngbr}</td>
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
            Installed by: ${employeeId}<br />
            Engineer: ${firstName} ${lastName}<br />
            Dealer: ${dealerCode}
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
            Digitally Authorised by ${customerName} / ${hospitalName} <br />
            by providing (OTP ${otp} sent on ${dateOfInstallation}) to
            <strong>${email}</strong> and
            <strong>${phoneNumber}</strong> by Skanray
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
        defective part shall be promptly packed to Skanray’s concerned
        office/service center in properly sealed packing freight, insurance
        and forwarding charges. Other claims, partially for compensation, are
        excluded.
      </p>
      <p class="warranty-text">
        Skanray’s standard terms of sale and installation and repairs are
        carried out by Skanray’s Engineer or Authorised Service Franchisee.
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
        from any attempt by any person other than Skanray’s personnel or
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
