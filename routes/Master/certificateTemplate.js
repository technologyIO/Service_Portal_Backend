module.exports = function getCertificateHTML(data) {
    const {
      // From DB
      name,
      serialnumber,
      materialcode,
      materialdescription,
      status,
      currentcustomer,
      custWarrantystartdate,
      custWarrantyenddate,
      palnumber,
  
      // From pdfData
      userInfo = {},
      dateOfInstallation = "",
      customerId = "",
      customerName = "",
      hospitalName = "",
      phoneNumber = "",
      email = "",
      city = "",
      postalCode = "",
      state = "",
      abnormalSiteCondition = "",
      supplyVoltage = {},
      otp,
    } = data;
  
    const {
      firstName = "",
      lastName = "",
      employeeId = "",
      userName = "",
    } = userInfo;
  
    const {
      lnry = "",
      lgyb = "",
      ngbr = "",
    } = supplyVoltage;
  
    return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>Installation Report & Warranty Certificate</title>
      <style>
        /* A4 page settings (portrait) */
        @page {
          size: A4;
          margin: 10mm;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
        }
        .main-container {
          width: 100%;
          margin: 0 auto;
          border: 2px solid rgb(198, 3, 3);
          padding: 25px;
          box-sizing: border-box;
        }
        table {
          border-collapse: collapse;
          width: 100%;
          font-size: 25px;
        }
        td {
          border: 1.5px solid #000;
          padding: 5px;
        }
        h1, h2, h3, p {
          margin: 0;
          padding: 0;
        }
        h1 {
          font-size: 55px;
        }
        p.title {
          font-size: 26px;
          font-weight: bold;
          text-align: center;
        }
        .disclaimer-box {
          border: 1.5px solid #000;
          padding: 10px;
          font-size: 19px;
          line-height: 1.6;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="main-container">
        <!-- Header -->
        <div style="margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; border: none;">
            <tr>
              <td style="width: 150px; vertical-align: middle; text-align: left;">
                <img
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRXw9vrbn9kBdgshQc4BipXz7u0XR6Zd4hwgg&s"
                  alt="Skanray Logo"
                  style="width: 120px; display: block;"
                />
              </td>
              <td style="vertical-align: middle; text-align: left;">
                <h1 style="margin: 0; margin-left: 100px;">Skanray Technologies Limited</h1>
                <p style="font-size: 34px; margin: 0; font-weight: bold; margin-left: 160px;">
                  Installation Report &amp; Warranty Certificate
                </p>
              </td>
            </tr>
          </table>
        </div>
  
        <!-- First table: Installation/Customer details -->
        <table style="margin-bottom: 20px;">
          <tr>
            <td>Date of Installation: ${dateOfInstallation}</td>
            <td>Installation Report #</td>
            <td><!-- If dynamic, put it here --></td>
          </tr>
          <tr>
            <td colspan="3">Customer Details: ${customerId}</td>
          </tr>
          <tr>
            <td>Name : ${customerName}</td>
            <td>Hospital Name: ${hospitalName}</td>
            <td></td>
          </tr>
          <tr>
            <td>Address 1 :</td>
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
            <td>AERB APP No.</td>
            <td>For X-Ray Equipments only</td>
            <td></td>
          </tr>
        </table>
  
        <!-- Second table: Equipment & Warranty -->
        <table style="margin-bottom: 20px;">
          <tr>
            <td style="width: 8%">S.No.</td>
            <td colspan="2">Equipment Description</td>
            <td colspan="2">Serial Number</td>
            <td colspan="2">Warranty End</td>
          </tr>
          <tr>
            <td>1</td>
            <td colspan="2">${materialdescription}</td>
            <td colspan="2">${serialnumber}</td>
            <td colspan="2">${custWarrantyenddate}</td>
          </tr>
          <tr>
            <td colspan="7">Site Conditions</td>
          </tr>
          <tr>
            <td colspan="7">Any abnormal site conditions: ${abnormalSiteCondition}</td>
          </tr>
          <tr>
            <td>Supply Voltage(V)</td>
            <td>L-N/R-Y</td>
            <td>${supplyVoltage.lnry || ""}</td>
            <td>L-G/Y-B</td>
            <td>${supplyVoltage.lgyb || ""}</td>
            <td>N-G/B-R</td>
            <td>${supplyVoltage.ngbr || ""}</td>
          </tr>
        </table>
  
        <!-- Disclaimer box -->
        <div class="disclaimer-box" style="margin-bottom: 20px;">
          <p style="margin: 0 0 10px;">
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
        <table style="font-size: 18px;">
          <tr>
            <td
              style="
                border: 1.5px solid #000;
                padding: 5px;
                width: 25%;
                vertical-align: top;
                font-weight: bold;
              "
            >
              Installed by #${employeeId}<br />
              Engineer: ${firstName} ${lastName}<br />
              Delear: ${userName}
            </td>
            <td
              style="
                border: 1.5px solid #000;
                font-weight: bold;
                padding: 5px;
                width: 45%;
                vertical-align: top;
              "
            >
              Digitally Authorised by ${customerName} / ${hospitalName} <br /> by providing 
              (OTP ${otp} sent on ${dateOfInstallation}) to ${email} and ${phoneNumber} by Skanray
            </td>
            <td style="border: 1.5px solid #000; padding: 5px; width: 30%;">
              <p style="font-weight: bold; margin: 0;">Signature valid</p>
              <div style="font-size: 15px;">
                Digitally signed by <br />
                SKANRAY TECHNOLOGIES LIMITED <br />
                P1 ${dateOfInstallation}
              </div>
              <img
                src="https://www.iconpacks.net/icons/2/free-check-icon-3278-thumb.png"
                alt="Signature Check"
                style="
                  width: 90px;
                  height: auto;
                  margin-top: -100px;
                  margin-left: 150px;
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
  