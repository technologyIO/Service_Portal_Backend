const express = require("express")
const router = express.Router()
const mongoose = require("mongoose")
const Customer = require("../../Model/UploadSchema/CustomerSchema")
const XLSX = require("xlsx")
const multer = require("multer")

// Configure memory storage
const storage = multer.memoryStorage()
const upload = multer({ storage })

// Bulk customer upload/update endpoint
router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Transfer-Encoding", "chunked")

  const response = {
    status: "processing",
    startTime: new Date(),
    totalRecords: 0,
    processedRecords: 0,
    createdCount: 0,
    updatedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    failures: [],
    creations: [],
    updates: [],
    skips: [],
    stats: {
      processingTime: 0,
      recordsPerSecond: 0,
    },
  }

  try {
    if (!req.file) {
      response.status = "failed"
      response.endTime = new Date()
      response.failures.push({
        error: "No file uploaded",
        suggestion: "Please upload a valid Excel file with customer data",
      })
      return res.status(400).json(response)
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" })
    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])

    if (!jsonData || jsonData.length === 0) {
      response.status = "failed"
      response.endTime = new Date()
      response.failures.push({
        error: "Empty file",
        suggestion: "The uploaded file contains no data. Please check the file and try again.",
      })
      return res.status(400).json(response)
    }

    response.totalRecords = jsonData.length
    res.write(JSON.stringify(response) + "\n")

    // Track seen customer codes to prevent duplicates in this batch
    const seenCustomerCodes = new Set()

    for (let i = 0; i < jsonData.length; i++) {
      const record = jsonData[i]
      const recordIdentifier = `Record ${i + 1}`

      try {
        // Field mapping for all possible Excel column names
        const fieldMappings = {
          customercodeid: ["customercodeid", "customerCode", "Customer Code"],
          customername: ["customername", "customerName", "Customer Name"],
          hospitalname: ["hospitalname", "hospitalName", "Hospital Name"],
          street: ["street", "Street Address"],
          city: ["city", "City"],
          postalcode: ["postalcode", "postalCode", "Postal Code", "pincode", "Pincode"],
          district: ["district", "District"],
          state: ["state", "State"],
          region: ["region", "Region"],
          country: ["country", "Country"],
          telephone: ["telephone", "phone", "Phone", "Phone Number"],
          taxnumber1: ["taxnumber1", "taxNumber1", "Tax ID 1"],
          taxnumber2: ["taxnumber2", "taxNumber2", "Tax ID 2"],
          email: ["email", "Email", "Email Address"],
          status: ["status", "Status"],
          customertype: ["customertype", "customerType", "Customer Type"],
        }

        // Build customer data object from Excel
        const customerData = {}
        for (const [field, aliases] of Object.entries(fieldMappings)) {
          for (const alias of aliases) {
            if (record[alias] !== undefined && record[alias] !== "") {
              customerData[field] = record[alias]
              break
            }
          }
        }

        // Only customercodeid is mandatory
        if (!customerData.customercodeid) {
          throw new Error(
            'Missing required field: customercodeid (must be present as "customercodeid", "customerCode", or "Customer Code")',
          )
        }

        // FIXED: Convert customercodeid to string and validate
        customerData.customercodeid = String(customerData.customercodeid).trim()

        // Validate customer code format (now accepts both strings and numbers)
        if (
          !customerData.customercodeid ||
          customerData.customercodeid === "" ||
          customerData.customercodeid === "undefined" ||
          customerData.customercodeid === "null"
        ) {
          throw new Error("Invalid customer code format. Customer code cannot be empty, null, or undefined.")
        }

        // Check for duplicates in this batch
        if (seenCustomerCodes.has(customerData.customercodeid)) {
          throw new Error(`Duplicate customer code in this upload batch: ${customerData.customercodeid}`)
        }
        seenCustomerCodes.add(customerData.customercodeid)

        // Check for existing customer
        const existingCustomer = await Customer.findOne({
          customercodeid: customerData.customercodeid,
        })

        if (existingCustomer) {
          // Track changes for all fields
          const changes = {}
          let hasChanges = false

          // Check each field that exists in the Excel
          for (const key in customerData) {
            // Skip comparison for these fields as they are handled separately
            if (key === "createdAt" || key === "modifiedAt") continue

            // Convert both values to strings for comparison to handle type differences
            const existingValue = String(existingCustomer[key] || "")
            const newValue = String(customerData[key] || "")

            if (existingValue !== newValue) {
              changes[key] = {
                old: existingCustomer[key],
                new: customerData[key],
              }
              hasChanges = true
            }
          }

          if (!hasChanges) {
            response.skippedCount++
            response.skips.push({
              record: recordIdentifier,
              customercodeid: customerData.customercodeid,
              message: "No changes detected - record matches existing data",
              details: {
                existingRecord: {
                  customername: existingCustomer.customername,
                  email: existingCustomer.email,
                  lastModified: existingCustomer.modifiedAt,
                },
              },
              timestamp: new Date(),
            })
            continue
          }

          // Update existing customer with modifiedAt timestamp
          const updateData = {
            ...customerData,
            modifiedAt: new Date(),
          }

          const updatedCustomer = await Customer.findOneAndUpdate(
            { customercodeid: customerData.customercodeid },
            updateData,
            { new: true },
          )

          response.updatedCount++
          response.updates.push({
            record: recordIdentifier,
            customercodeid: customerData.customercodeid,
            changes: changes,
            details: {
              previousData: {
                customername: existingCustomer.customername,
                email: existingCustomer.email,
              },
              newData: {
                customername: updatedCustomer.customername,
                email: updatedCustomer.email,
              },
            },
            timestamp: new Date(),
          })
        } else {
          // Create new customer with timestamps
          const newCustomerData = {
            ...customerData,
            createdAt: new Date(),
            modifiedAt: new Date(),
          }

          // Set default values for required fields if not provided
          if (!newCustomerData.hospitalname) newCustomerData.hospitalname = "Unknown"
          if (!newCustomerData.email) newCustomerData.email = "no-email@example.com"
          if (!newCustomerData.status) newCustomerData.status = "active"

          const customer = new Customer(newCustomerData)
          await customer.save()

          response.createdCount++
          response.creations.push({
            record: recordIdentifier,
            customercodeid: customer.customercodeid,
            details: {
              customername: customer.customername,
              email: customer.email,
              hospitalname: customer.hospitalname,
            },
            timestamp: new Date(),
          })
        }
      } catch (error) {
        response.failedCount++
        response.failures.push({
          record: recordIdentifier,
          data: {
            customercodeid: record.customercodeid || record.customerCode || record["Customer Code"] || "N/A",
            customername: record.customername || record.customerName || record["Customer Name"] || "N/A",
          },
          error: error.message,
          suggestion: error.message.includes("required field")
            ? "Please ensure the customer code is provided in the Excel file"
            : error.message.includes("Duplicate")
              ? "Remove duplicate entries from your upload file"
              : error.message.includes("Invalid customer code format")
                ? "Customer codes can be numbers or text, but cannot be empty. Check your Excel file for empty customer code cells."
                : "Please check the data format and try again",
          timestamp: new Date(),
        })
      } finally {
        response.processedRecords++

        // Calculate processing stats
        const elapsedTime = (new Date() - response.startTime) / 1000
        response.stats.processingTime = elapsedTime
        response.stats.recordsPerSecond = response.processedRecords / elapsedTime

        // Send progress update every 10 records or at the end
        if (i % 10 === 0 || i === jsonData.length - 1) {
          res.write(
            JSON.stringify({
              status: response.status,
              processedRecords: response.processedRecords,
              progress: `${Math.round((response.processedRecords / response.totalRecords) * 100)}%`,
              stats: response.stats,
              currentCounts: {
                created: response.createdCount,
                updated: response.updatedCount,
                skipped: response.skippedCount,
                failed: response.failedCount,
              },
            }) + "\n",
          )
        }
      }
    }

    // Final status determination
    if (response.failedCount === 0) {
      response.status = response.skippedCount > 0 ? "completed_with_skips" : "completed"
    } else {
      response.status = "completed_with_errors"
    }

    response.endTime = new Date()
    response.stats.processingTime = (response.endTime - response.startTime) / 1000
    response.stats.recordsPerSecond = response.totalRecords / response.stats.processingTime

    // Add summary information
    response.summary = {
      totalProcessed: response.processedRecords,
      successRate: `${(((response.createdCount + response.updatedCount) / response.totalRecords) * 100).toFixed(2)}%`,
      creationRate: `${((response.createdCount / response.totalRecords) * 100).toFixed(2)}%`,
      updateRate: `${((response.updatedCount / response.totalRecords) * 100).toFixed(2)}%`,
      failureRate: `${((response.failedCount / response.totalRecords) * 100).toFixed(2)}%`,
      skipRate: `${((response.skippedCount / response.totalRecords) * 100).toFixed(2)}%`,
      timeTaken: `${response.stats.processingTime.toFixed(2)} seconds`,
      performance:
        response.stats.recordsPerSecond > 10 ? "good" : response.stats.recordsPerSecond > 5 ? "average" : "slow",
    }

    res.write(JSON.stringify(response) + "\n")
    res.end()
  } catch (error) {
    console.error("Bulk upload failed:", error)
    response.status = "failed"
    response.endTime = new Date()
    response.stats.processingTime = (response.endTime - response.startTime) / 1000
    response.failures.push({
      error: error.message,
      suggestion:
        "Please check the file format and try again. Ensure it is a valid Excel file with proper column headers.",
      timestamp: new Date(),
    })
    res.write(JSON.stringify(response) + "\n")
    res.end()
  }
})

module.exports = router
