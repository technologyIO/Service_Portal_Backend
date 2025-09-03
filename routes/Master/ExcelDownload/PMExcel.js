const express = require("express");
const ExcelJS = require("exceljs");
const PM = require("../../../Model/UploadSchema/PMSchema");
const router = express.Router();

// Ultra-light PM Excel export API
router.get("/export-pm", async (req, res) => {
  const {
    dateFrom,
    dateTo,
    dueFrom,
    dueTo,
    doneFrom,
    doneTo,
    pmStatus,
    region,
    searchQuery,
  } = req.query;

  const fileName = `pm_data_${new Date().toISOString().split("T")[0]}.xlsx`;
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  try {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: false, // Disable styles for maximum performance
      useSharedStrings: true,
    });

    const worksheet = workbook.addWorksheet("PM Data");

    // Minimal column definitions (no styling)
    worksheet.columns = [
      { header: "S.No", key: "sno" },
      { header: "PM Type", key: "pmType" },
      { header: "PM Number", key: "pmNumber" },
      { header: "Material Description", key: "materialDescription" },
      { header: "Document Number", key: "documentnumber" },
      { header: "Serial Number", key: "serialNumber" },
      { header: "Customer Code", key: "customerCode" },
      { header: "Region", key: "region" },
      { header: "City", key: "city" },
      { header: "PM Due Month", key: "pmDueMonth" },
      { header: "PM Done Date", key: "pmDoneDate" },
      { header: "PM Vendor Code", key: "pmVendorCode" },
      { header: "PM Engineer Code", key: "pmEngineerCode" },
      { header: "PM Status", key: "pmStatus" },
      { header: "Part Number", key: "partNumber" },
      { header: "Created At", key: "createdAt" },
      { header: "Updated At", key: "updatedAt" },
    ];

    let query = {};
    let pipeline = [];

    if (
      dateFrom ||
      dateTo ||
      dueFrom ||
      dueTo ||
      doneFrom ||
      doneTo ||
      pmStatus ||
      region ||
      searchQuery
    ) {
      // Add date conversion fields
      pipeline.push({
        $addFields: {
          pmDoneDateConverted: {
            $cond: {
              if: {
                $and: [
                  { $ne: ["$pmDoneDate", null] },
                  { $ne: ["$pmDoneDate", ""] },
                ],
              },
              then: {
                $dateFromString: {
                  dateString: "$pmDoneDate",
                  format: "%d/%m/%Y",
                  onError: null,
                },
              },
              else: null,
            },
          },
          pmDueDateConverted: {
            $cond: {
              if: {
                $and: [
                  { $ne: ["$pmDueMonth", null] },
                  { $ne: ["$pmDueMonth", ""] },
                ],
              },
              then: {
                $dateFromString: {
                  dateString: { $concat: ["01/", "$pmDueMonth"] },
                  format: "%d/%m/%Y",
                  onError: null,
                },
              },
              else: null,
            },
          },
        },
      });

      // Build match conditions
      const matchConditions = {};

      // Creation Date range filter
      if (dateFrom || dateTo) {
        matchConditions.createdAt = {};
        if (dateFrom) {
          const startDate = new Date(dateFrom);
          startDate.setHours(0, 0, 0, 0);
          matchConditions.createdAt.$gte = startDate;
        }
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          matchConditions.createdAt.$lte = endDate;
        }
      }

      // PM Due Date range filter
      if (dueFrom || dueTo) {
        matchConditions.pmDueDateConverted = {};
        if (dueFrom) {
          const startDate = new Date(dueFrom);
          startDate.setHours(0, 0, 0, 0);
          matchConditions.pmDueDateConverted.$gte = startDate;
        }
        if (dueTo) {
          const endDate = new Date(dueTo);
          endDate.setHours(23, 59, 59, 999);
          matchConditions.pmDueDateConverted.$lte = endDate;
        }
      }

      // PM Done Date range filter
      if (doneFrom || doneTo) {
        matchConditions.pmDoneDateConverted = {};
        if (doneFrom) {
          const startDate = new Date(doneFrom);
          startDate.setHours(0, 0, 0, 0);
          matchConditions.pmDoneDateConverted.$gte = startDate;
        }
        if (doneTo) {
          const endDate = new Date(doneTo);
          endDate.setHours(23, 59, 59, 999);
          matchConditions.pmDoneDateConverted.$lte = endDate;
        }
      }

      // Status filter
      if (pmStatus && pmStatus !== "all") {
        matchConditions.pmStatus = { $regex: pmStatus, $options: "i" };
      }

      // Region filter
      if (region && region !== "all") {
        matchConditions.region = { $regex: region, $options: "i" };
      }

      // Search query filter
      if (searchQuery && searchQuery.trim()) {
        matchConditions.$or = [
          { pmNumber: new RegExp(searchQuery, "i") },
          { serialNumber: new RegExp(searchQuery, "i") },
          { materialDescription: new RegExp(searchQuery, "i") },
          { customerCode: new RegExp(searchQuery, "i") },
          { pmVendorCode: new RegExp(searchQuery, "i") },
          { pmEngineerCode: new RegExp(searchQuery, "i") },
          { partNumber: new RegExp(searchQuery, "i") },
          { documentnumber: new RegExp(searchQuery, "i") },
          { region: new RegExp(searchQuery, "i") },
          { city: new RegExp(searchQuery, "i") },
          { pmType: new RegExp(searchQuery, "i") },
          { pmStatus: new RegExp(searchQuery, "i") },
        ];
      }

      // Add match stage
      if (Object.keys(matchConditions).length > 0) {
        pipeline.push({ $match: matchConditions });
      }

      // Remove converted fields from output
      pipeline.push({
        $project: {
          pmDoneDateConverted: 0,
          pmDueDateConverted: 0,
        },
      });
    }

    let cursor;
    if (pipeline.length > 0) {
      cursor = PM.aggregate(pipeline).cursor();
    } else {
      cursor = PM.find().lean().cursor();
    }

    let rowCount = 0;

    cursor.on("data", (pm) => {
      rowCount++;
      worksheet
        .addRow({
          sno: rowCount,
          pmType: pm.pmType || "",
          pmNumber: pm.pmNumber || "",
          materialDescription: pm.materialDescription || "",
          documentnumber: pm.documentnumber || "",
          serialNumber: pm.serialNumber || "",
          customerCode: pm.customerCode || "",
          region: pm.region || "",
          city: pm.city || "",
          pmDueMonth: pm.pmDueMonth || "",
          pmDoneDate: pm.pmDoneDate || "",
          pmVendorCode: pm.pmVendorCode || "",
          pmEngineerCode: pm.pmEngineerCode || "",
          pmStatus: pm.pmStatus || "",
          partNumber: pm.partNumber || "",
          createdAt: pm.createdAt
            ? new Date(pm.createdAt).toLocaleDateString("en-IN")
            : "",
          updatedAt: pm.updatedAt
            ? new Date(pm.updatedAt).toLocaleDateString("en-IN")
            : "",
        })
        .commit(); // Commit immediately
    });

    cursor.on("error", (err) => {
      console.error("Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
      workbook.rollback();
    });

    cursor.on("end", async () => {
      try {
        await workbook.commit();
      } catch (err) {
        if (!res.headersSent) {
          res.status(500).json({ error: err.message });
        }
      }
    });
  } catch (error) {
    console.error("Export failed:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

module.exports = router;
