const { parse, isValid, format, addMonths, differenceInMonths, startOfMonth } = require("date-fns")
const XLSX = require("xlsx")
const express = require("express")
const router = express.Router()
const multer = require("multer")
const mongoose = require("mongoose")
const csv = require("csv-parser")
const fs = require("fs")
const path = require("path")
const { Transform } = require("stream")
const xml2js = require("xml2js")

// Import Mongoose models
const Equipment = require("../../Model/MasterSchema/EquipmentSchema")
const PM = require("../../Model/UploadSchema/PMSchema")
const Product = require("../../Model/MasterSchema/ProductSchema")
const AMCContract = require("../../Model/UploadSchema/AMCContractSchema")
const Customer = require("../../Model/UploadSchema/CustomerSchema")
const JobProgress = require("../../Model/BulkUplaod/EquipmentJobProgressSchema")
const JobResult = require("../../Model//BulkUplaod/EquipmentJobResultSchema")

// Enhanced multer configuration with disk storage for large files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads/temp")
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, `bulk-upload-${uniqueSuffix}-${file.originalname}`)
  },
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/csv",
      "text/tab-separated-values",
      "application/json",
      "text/xml",
      "application/xml",
    ]
    const allowedExtensions = [".xlsx", ".xls", ".csv", ".tsv", ".json", ".xml"]
    const fileExtension = path.extname(file.originalname).toLowerCase()

    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true)
    } else {
      cb(new Error("Unsupported file format. Supported formats: Excel (.xlsx, .xls), CSV, TSV, JSON, XML"), false)
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
})

const FIELD_MAPPINGS = {
  materialcode: [
    "material code",
    "materialcode",
    "material_code",
    "part_number",
    "partnumber",
    "part number",
    "product_code",
    "productcode",
    "item_code",
    "itemcode",
    "material",
  ],
  materialdescription: [
    "material description",
    "materialdescription",
    "material_description",
    "description",
    "product_description",
    "item_description",
    "product_name",
    "item_name",
  ],
  serialnumber: [
    "serial number",
    "serialnumber",
    "serial_number",
    "serial",
    "sn",
    "serial_no",
    "equipment_serial",
    "machine_serial",
  ],
  equipmentid: ["equipment", "equipmentid", "equipment_id", "equipment id", "machine_id", "machineid"],
  currentcustomer: [
    "currentcustomer", "current_customer", "customer_code", "customercode", "customer", "custcode", "curcustomer",
  ],
  endcustomer: [
    "end customer",
    "endcustomer",
    "end_customer",
    "final_customer",
    "end_user",
    "ultimate_customer",
    "final_client",
  ],
  custWarrantystartdate: [
    "custwarrantystart",
    "custwarrantystartdate",
    "cust_warranty_start_date",
    "warranty_start",
    "warranty start date",
    "customer warranty start",
    "warranty_start_date",
    "cust_warranty_start",
    "customer warranty start date",
    "customerwarrantystartdate",
    "customer warranty start",
    "customer_warranty_startdate",
    "customer_warranty_start",
    "customer warrantystartdate",
    "customer warranty startdate",
    "customerwarrantystart",
    "cus. wrty start",
  ],
  custWarrantyenddate: [
    "custwarrantyend",
    "custwarrantyenddate",
    "cust_warranty_end_date",
    "warranty_end",
    "warranty end date",
    "customer warranty end",
    "warranty_end_date",
    "cust_warranty_end",
    "customer warranty end date",
    "customerwarrantyenddate",
    "customer warranty end",
    "customer_warranty_enddate",
    "customer_warranty_end",
    "customer warrantyenddate",
    "customer warranty enddate",
    "customerwarrantyend",
    "Cust. wrty end",
  ],
  dealerwarrantystartdate: [
    "dealerwarrantystart",
    "dealerwarrantystartdate",
    "dealer_warranty_start_date",
    "dealer warranty start",
    "extended warranty start",
    "dealer_warranty_start",
  ],
  dealerwarrantyenddate: [
    "dealerwarrantyend",
    "dealerwarrantyenddate",
    "dealer_warranty_end_date",
    "dealer warranty end",
    "extended warranty end",
    "dealer_warranty_end",
  ],
  dealer: [
    "dealer", "dealer_name", "dealername", "distributor", "partner", "vendor",
  ],
  palnumber: ["pal number", "palnumber", "pal_number", "pal no", "pal_no", "pal"],
  installationreportno: [
    "ir number",
    "irnumber",
    "ir_number",
    "installationreportno",
    "installation_report_no",
    "installation report no",
    "installation_no",
    "install_report_no",
    "ir_no",
  ],
  status: [
    "status",
    "equipment_status",
    "equipment status",
    "machine_status",
    "machine status",
    "active_status",
    "current_status",
    "state",
  ],
}

// Enhanced error categorization
const ERROR_CATEGORIES = {
  VALIDATION_ERROR: "ValidationError",
  MISSING_FIELD: "MissingRequiredField",
  DUPLICATE_RECORD: "DuplicateRecord",
  DATABASE_ERROR: "DatabaseError",
  PARSE_ERROR: "ParseError",
  BUSINESS_RULE_ERROR: "BusinessRuleError",
  FOREIGN_KEY_ERROR: "ForeignKeyError",
  DATE_FORMAT_ERROR: "DateFormatError",
}

const CONFIG = {
  EQUIPMENT_BATCH_SIZE: 500, // Reduced from 1000
  PM_BATCH_SIZE: 2000, // Reduced from 5000
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  MEMORY_THRESHOLD: 0.6, // Reduced from 0.8
  MAX_EQUIPMENT_RESULTS_PER_CHUNK: 1500, // Reduced from 3000
  MAX_DOCUMENT_SIZE_MB: 10, // Reduced from 14
  CHUNK_SIZE_CHECK_INTERVAL: 200, // Reduced from 500
  FORCE_GC_INTERVAL: 1000, // Force garbage collection every 1000 records
};
// Enhanced memory cleanup
function aggressiveMemoryCleanup() {
  if (global.gc) {
    global.gc();
  }

  // Clear any large objects from memory
  if (process.memoryUsage().heapUsed > 400 * 1024 * 1024) { // 400MB threshold
    console.log('Aggressive memory cleanup triggered');
    global.gc && global.gc();
    setTimeout(() => global.gc && global.gc(), 100);
  }
}
// Utility functions (keeping all existing ones)
function generateEquipmentId(serialnumber, materialcode) {
  const timestamp = Date.now().toString()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  const cleanSerial = serialnumber.replace(/[^a-zA-Z0-9]/g, "").substring(0, 8)
  const cleanMaterial = materialcode.replace(/[^a-zA-Z0-9]/g, "").substring(0, 6)
  return `EQ_${cleanSerial}_${cleanMaterial}_${timestamp.slice(-8)}_${random}`.toUpperCase()
}

function normalizeFieldNames(record) {
  const normalized = {}
  const recordKeysLower = {}

  Object.keys(record).forEach((key) => {
    recordKeysLower[key.toLowerCase().trim()] = record[key]
  })

  for (const [standardField, variations] of Object.entries(FIELD_MAPPINGS)) {
    for (const variation of variations) {
      const variationLower = variation.toLowerCase().trim()

      const matchingKey = Object.keys(recordKeysLower).find((key) => {
        const keyNormalized = key.replace(/[_\s\-.]/g, "")
        const variationNormalized = variationLower.replace(/[_\s\-.]/g, "")
        return key === variationLower || keyNormalized === variationNormalized
      })

      if (matchingKey && recordKeysLower[matchingKey] != null && recordKeysLower[matchingKey] !== "") {
        normalized[standardField] = recordKeysLower[matchingKey]
        break
      }
    }
  }

  return normalized
}

function getDetailedChanges(existingRecord, newRecord) {
  const fieldsToCompare = [
    "materialdescription",
    "materialcode",
    "currentcustomer",
    "endcustomer",
    "custWarrantystartdate",
    "custWarrantyenddate",
    "dealerwarrantystartdate",
    "dealerwarrantyenddate",
    "dealer",
    "status",
    "palnumber",
    "installationreportno",
  ]

  const changes = {}
  let hasChanges = false

  for (const field of fieldsToCompare) {
    const existingValue = existingRecord[field]
    const newValue = newRecord[field]

    const existing =
      existingValue === null || existingValue === undefined || existingValue === "" ? "" : String(existingValue).trim()
    const incoming = newValue === null || newValue === undefined || newValue === "" ? "" : String(newValue).trim()

    if (existing !== incoming && !(existing === "" && incoming === "")) {
      changes[field] = {
        old: existing || null,
        new: incoming || null,
        fieldName: field,
      }
      hasChanges = true
    }
  }

  return { hasChanges, changes }
}

// NEW: Helper function to estimate document size
function estimateDocumentSize(obj) {
  try {
    return Buffer.byteLength(JSON.stringify(obj), 'utf8');
  } catch (error) {
    // Fallback estimation
    return JSON.stringify(obj).length * 2;
  }
}

// FIXED: Complete corrected function
async function saveJobResultsInChunks(jobId, equipmentResults, pmResults, summary, errors, warnings) {
  const maxChunkSize = CONFIG.MAX_EQUIPMENT_RESULTS_PER_CHUNK;
  const maxSizeBytes = CONFIG.MAX_DOCUMENT_SIZE_MB * 1024 * 1024;

  console.log(`Preparing to save ${equipmentResults.length} equipment results for job ${jobId}`);

  const mainDocument = {
    jobId,
    equipmentResults: [],
    pmResults: [],
    summary,
    errors: errors.slice(0, 500),
    warnings: warnings.slice(0, 500),
    totalChunks: 0,
    totalEquipmentResults: equipmentResults.length,
    totalPMResults: pmResults.length,
    isChunk: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // FIXED: Proper size estimation
  const sampleSize = Math.min(50, equipmentResults.length);
  if (sampleSize === 0) {
    await JobResult.create(mainDocument);
    return;
  }

  const sampleData = equipmentResults.slice(0, sampleSize);
  const avgRecordSize = estimateDocumentSize({ equipmentResults: sampleData }) / sampleSize;
  const estimatedTotalSize = avgRecordSize * equipmentResults.length;

  const needsChunking = equipmentResults.length > maxChunkSize || estimatedTotalSize > maxSizeBytes;

  if (!needsChunking) {
    console.log(`Small dataset (${equipmentResults.length} results). Saving without chunking.`);
    mainDocument.equipmentResults = equipmentResults;
    mainDocument.pmResults = pmResults;
    await JobResult.create(mainDocument);
    return;
  }

  // FIXED: Use correct variable names
  console.log(`Large dataset detected (${equipmentResults.length} results, ~${Math.round(estimatedTotalSize / (1024 * 1024))}MB). Using chunking strategy.`);

  // Rest of the chunking logic remains the same...
  const chunks = [];
  let currentChunk = [];
  let currentChunkSize = 0;
  let chunkIndex = 0;

  for (let i = 0; i < equipmentResults.length; i++) {
    const result = equipmentResults[i];

    // Simplify result to reduce memory footprint
    const simplifiedResult = {
      ...result,
      pmResults: result.pmResults ? result.pmResults.slice(0, 50) : []
    };
    const resultSize = estimateDocumentSize(simplifiedResult);

    if ((currentChunk.length >= maxChunkSize) ||
      (currentChunkSize + resultSize > maxSizeBytes && currentChunk.length > 0)) {

      chunks.push({
        equipmentResults: currentChunk,
        chunkSize: currentChunkSize,
        chunkIndex: chunkIndex++,
        resultCount: currentChunk.length
      });

      currentChunk = [result];
      currentChunkSize = resultSize;
    } else {
      currentChunk.push(result);
      currentChunkSize += resultSize;
    }

    // Memory cleanup during chunking
    if (i % 500 === 0 && i > 0) {
      aggressiveMemoryCleanup();
      console.log(`Processed ${i}/${equipmentResults.length} results for chunking (Memory: ${checkMemoryUsage().heapUsed}MB)`);
    }
  }

  // Add final chunk
  if (currentChunk.length > 0) {
    chunks.push({
      equipmentResults: currentChunk,
      chunkSize: currentChunkSize,
      chunkIndex: chunkIndex++,
      resultCount: currentChunk.length
    });
  }

  mainDocument.totalChunks = chunks.length;
  console.log(`Splitting into ${chunks.length} chunks`);

  // Save main document
  await JobResult.create(mainDocument);
  console.log(`Saved main document for job ${jobId}`);

  // Save chunks
  for (const chunk of chunks) {
    try {
      await JobResult.create({
        jobId: `${jobId}_chunk_${chunk.chunkIndex}`,
        parentJobId: jobId,
        equipmentResults: chunk.equipmentResults,
        pmResults: [],
        summary: null,
        errors: [],
        warnings: [],
        isChunk: true,
        chunkIndex: chunk.chunkIndex,
        chunkSize: Math.round(chunk.chunkSize / (1024 * 1024) * 100) / 100,
        resultCount: chunk.resultCount,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      aggressiveMemoryCleanup();
      console.log(`Saved chunk ${chunk.chunkIndex + 1}/${chunks.length} (${chunk.resultCount} results, ${Math.round(chunk.chunkSize / (1024 * 1024) * 100) / 100}MB)`);

    } catch (chunkError) {
      console.error(`Failed to save chunk ${chunk.chunkIndex}:`, chunkError);
      throw new Error(`Chunk save failed: ${chunkError.message}`);
    }
  }

  console.log(`Successfully saved ${chunks.length} chunks for job ${jobId}`);
}



// Enhanced getJobResults function with optimized chunked data retrieval
async function getJobResults(jobId, type, page, limit) {
  try {
    const mainJobResult = await JobResult.findOne({ jobId, isChunk: { $ne: true } });
    if (!mainJobResult) return { data: [], pagination: {} };

    let data = [];

    if (type === "equipment") {
      if (mainJobResult.totalChunks && mainJobResult.totalChunks > 0) {
        // FIXED: Proper chunk-based pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        // Get total count first
        const totalCount = mainJobResult.totalEquipmentResults || 0;

        if (startIndex >= totalCount) {
          return {
            data: [],
            pagination: {
              currentPage: page,
              totalPages: Math.ceil(totalCount / limit),
              totalRecords: totalCount,
              recordsPerPage: limit,
              hasNext: false,
              hasPrev: page > 1,
              startRecord: 0,
              endRecord: 0,
            }
          };
        }

        let processedCount = 0;
        let collectedData = [];

        // Get chunks in order
        const chunks = await JobResult.find(
          { parentJobId: jobId, isChunk: true },
          { chunkIndex: 1, resultCount: 1, _id: 1 }
        ).sort({ chunkIndex: 1 });

        for (const chunkMeta of chunks) {
          const chunkStart = processedCount;
          const chunkEnd = processedCount + (chunkMeta.resultCount || 0);

          // Check if this chunk overlaps with our pagination window
          if (chunkEnd > startIndex && chunkStart < endIndex) {
            // Calculate slice within this chunk
            const skipInChunk = Math.max(0, startIndex - chunkStart);
            const takeFromChunk = Math.min(
              limit - collectedData.length,
              chunkEnd - Math.max(startIndex, chunkStart)
            );

            if (takeFromChunk > 0) {
              const chunk = await JobResult.findOne(
                { parentJobId: jobId, isChunk: true, chunkIndex: chunkMeta.chunkIndex }
              );

              if (chunk && chunk.equipmentResults) {
                const slicedData = chunk.equipmentResults.slice(
                  skipInChunk,
                  skipInChunk + takeFromChunk
                );
                collectedData.push(...slicedData);
              }
            }
          }

          processedCount = chunkEnd;

          // Stop if we have enough data
          if (collectedData.length >= limit) break;
        }
        return {
          data: collectedData,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalRecords: totalCount,
            recordsPerPage: limit,
            hasNext: endIndex < totalCount,
            hasPrev: page > 1,
            startRecord: startIndex + 1,
            endRecord: Math.min(endIndex, totalCount),
          },
        };
      } else {
        // Non-chunked data
        data = mainJobResult.equipmentResults || [];
      }
    } else if (type === "pm") {
      // For PM data, extract from equipment results
      if (mainJobResult.totalChunks && mainJobResult.totalChunks > 0) {
        const chunks = await JobResult.find(
          { parentJobId: jobId, isChunk: true },
          { equipmentResults: 1 }
        ).sort({ chunkIndex: 1 });

        // Extract PM results from equipment results in chunks
        data = chunks.reduce((acc, chunk) => {
          (chunk.equipmentResults || []).forEach(equipment => {
            if (equipment.pmResults && equipment.pmResults.length > 0) {
              acc.push(...equipment.pmResults.map(pm => ({
                ...pm,
                serialNumber: equipment.serialnumber,
                equipmentId: equipment.equipmentid
              })));
            }
          });
          return acc;
        }, []);
      } else {
        data = mainJobResult.pmResults || [];
      }
    } else if (type === "errors") {
      // Handle errors from both main document and chunks
      data = [...(mainJobResult.errors || [])];

      if (mainJobResult.totalChunks && mainJobResult.totalChunks > 0) {
        const chunks = await JobResult.find(
          { parentJobId: jobId, isChunk: true },
          { equipmentResults: 1 }
        );

        chunks.forEach(chunk => {
          (chunk.equipmentResults || []).forEach((equipment, index) => {
            // Add equipment-level errors
            if (equipment.allErrors && equipment.allErrors.length > 0) {
              equipment.allErrors.forEach(error => {
                data.push({
                  ...error,
                  serialNumber: equipment.serialnumber,
                  equipmentId: equipment.equipmentid,
                  lineNumber: equipment.lineNumber,
                  source: 'equipment',
                  recordIndex: index
                });
              });
            }

            // Add equipment general errors
            if (equipment.status === 'Failed' && equipment.error) {
              data.push({
                category: equipment.category || 'ProcessingError',
                field: null,
                message: equipment.error,
                serialNumber: equipment.serialnumber,
                equipmentId: equipment.equipmentid,
                lineNumber: equipment.lineNumber,
                source: 'equipment',
                recordIndex: index
              });
            }

            // Add PM-related errors
            if (equipment.pmResults && equipment.pmResults.length > 0) {
              equipment.pmResults.forEach(pm => {
                if (pm.status === 'Failed' || pm.error) {
                  data.push({
                    category: pm.category || 'PM_Error',
                    field: pm.pmType,
                    message: pm.error || pm.reason || 'PM task failed',
                    serialNumber: equipment.serialnumber,
                    equipmentId: equipment.equipmentid,
                    lineNumber: equipment.lineNumber,
                    pmType: pm.pmType,
                    source: 'pm',
                    recordIndex: index
                  });
                }
              });
            }
          });
        });
      }
    } else if (type === "warnings") {
      // Handle warnings from both main document and chunks
      data = [...(mainJobResult.warnings || [])];

      if (mainJobResult.totalChunks && mainJobResult.totalChunks > 0) {
        const chunks = await JobResult.find(
          { parentJobId: jobId, isChunk: true },
          { equipmentResults: 1 }
        );

        chunks.forEach(chunk => {
          (chunk.equipmentResults || []).forEach((equipment, index) => {
            if (equipment.warnings && equipment.warnings.length > 0) {
              equipment.warnings.forEach(warning => {
                data.push({
                  ...warning,
                  serialNumber: equipment.serialnumber,
                  equipmentId: equipment.equipmentid,
                  lineNumber: equipment.lineNumber,
                  source: 'equipment',
                  recordIndex: index
                });
              });
            }
          });
        });
      }
    } else {
      // Default case - return equipment results
      if (mainJobResult.totalChunks && mainJobResult.totalChunks > 0) {
        return await getJobResults(jobId, "equipment", page, limit);
      } else {
        data = mainJobResult.equipmentResults || [];
      }
    }

    // Apply pagination to the combined data (for non-equipment types or non-chunked data)
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(data.length / limit),
        totalRecords: data.length,
        recordsPerPage: limit,
        hasNext: endIndex < data.length,
        hasPrev: page > 1,
        startRecord: startIndex + 1,
        endRecord: Math.min(endIndex, data.length),
      },
    };
  } catch (error) {
    console.error("Error getting job results:", error);
    return { data: [], pagination: {} };
  }
}

// Enhanced file parsing functions (keeping existing code)
async function parseFile(filePath, fileExtension) {
  const startTime = Date.now()
  let records = []

  try {
    switch (fileExtension.toLowerCase()) {
      case ".csv":
        records = await parseCSVFile(filePath, ",")
        break
      case ".tsv":
        records = await parseCSVFile(filePath, "\t")
        break
      case ".xlsx":
      case ".xls":
        records = await parseExcelFile(filePath)
        break
      case ".json":
        records = await parseJSONFile(filePath)
        break
      case ".xml":
        records = await parseXMLFile(filePath)
        break
      default:
        throw new Error(`Unsupported file format: ${fileExtension}`)
    }

    const parseTime = Date.now() - startTime
    return { records, parseTime, recordCount: records.length }
  } catch (error) {
    throw new Error(`File parsing failed for ${fileExtension}: ${error.message}`)
  }
}

function parseCSVFile(filePath, delimiter = ",") {
  return new Promise((resolve, reject) => {
    const results = []
    let headers = []
    const isFirstRow = true

    const stream = fs
      .createReadStream(filePath)
      .pipe(csv({ separator: delimiter, skipEmptyLines: true }))
      .on("headers", (headerList) => {
        headers = headerList
      })
      .on("data", (data) => {
        try {
          const normalizedRecord = normalizeFieldNames(data)
          if (Object.keys(normalizedRecord).length > 0) {
            results.push(normalizedRecord)
          }
        } catch (error) {
          console.error("Error processing CSV row:", error)
        }
      })
      .on("end", () => {
        resolve(results)
      })
      .on("error", (error) => {
        reject(error)
      })
  })
}

async function parseExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath, {
      cellDates: true,
      cellNF: false,
      cellText: false,
    })

    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      dateNF: "yyyy-mm-dd",
    })

    return jsonData.map((record) => normalizeFieldNames(record)).filter((record) => Object.keys(record).length > 0)
  } catch (error) {
    throw new Error(`Excel parsing error: ${error.message}`)
  }
}

async function parseJSONFile(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, "utf8")
    const data = JSON.parse(fileContent)

    let records = []
    if (Array.isArray(data)) {
      records = data
    } else if (data.records && Array.isArray(data.records)) {
      records = data.records
    } else {
      records = [data]
    }

    return records.map((record) => normalizeFieldNames(record)).filter((record) => Object.keys(record).length > 0)
  } catch (error) {
    throw new Error(`JSON parsing error: ${error.message}`)
  }
}

async function parseXMLFile(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, "utf8")
    const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true })

    return new Promise((resolve, reject) => {
      parser.parseString(fileContent, (err, result) => {
        if (err) return reject(err)

        let records = []
        if (result.records && result.records.record) {
          records = Array.isArray(result.records.record) ? result.records.record : [result.records.record]
        } else if (result.equipment && Array.isArray(result.equipment)) {
          records = result.equipment
        } else {
          records = [result]
        }

        const normalizedRecords = records
          .map((record) => normalizeFieldNames(record))
          .filter((record) => Object.keys(record).length > 0)

        resolve(normalizedRecords)
      })
    })
  } catch (error) {
    throw new Error(`XML parsing error: ${error.message}`)
  }
}

// Date and PM utility functions (keeping existing code)
function parseUniversalDate(dateInput) {
  if (dateInput == null || dateInput === "") return null

  if (dateInput instanceof Date && !isNaN(dateInput)) {
    return dateInput
  }

  if (typeof dateInput === "number") {
    try {
      if (dateInput > 25567) {
        const excelDate = new Date((dateInput - 25567) * 86400 * 1000)
        return excelDate
      } else {
        const excelDate = XLSX.SSF.parse_date_code(dateInput)
        return new Date(excelDate.y, excelDate.m - 1, excelDate.d)
      }
    } catch (e) {
      return null
    }
  }

  if (typeof dateInput === "string") {
    const dateOnly = dateInput.split(" ")[0]
    const formats = [
      "dd/MM/yyyy",
      "dd-MM-yyyy",
      "dd.MM.yyyy",
      "MM/dd/yyyy",
      "MM-dd-yyyy",
      "MM.dd.yyyy",
      "yyyy/MM/dd",
      "yyyy-MM-dd",
      "yyyy.MM.dd",
      "d/M/yyyy",
      "d-M-yyyy",
      "d.M.yyyy",
      "M/d/yyyy",
      "M-d-yyyy",
      "M.d.yyyy",
      "yyyy/M/d",
      "yyyy-M-d",
      "yyyy.M.d",
    ]

    for (const dateFormat of formats) {
      try {
        const parsedDate = parse(dateOnly, dateFormat, new Date())
        if (isValid(parsedDate)) {
          return parsedDate
        }
      } catch {
        continue
      }
    }

    const nativeDate = new Date(dateInput)
    if (!isNaN(nativeDate)) {
      return nativeDate
    }
  }

  return null
}

function toISODateString(date) {
  if (!date) return null
  const d = new Date(date)
  if (isNaN(d.getTime())) return null
  return format(d, "yyyy-MM-dd")
}

function getPMFrequencyMonths(frequency) {
  const freq = Number.parseInt(frequency, 10)
  if (freq === 2) return 6 // Twice per year
  if (freq === 4) return 3 // 4 times per year
  if (freq === 3) return 4 // 3 times per year
  if (freq === 1) return 12 // Once per year
  if (freq === 6) return 2 // 6 times per year
  return 6 // Default: twice per year
}

function calculatePMStatus(dueDateStr) {
  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1
  const currentYear = currentDate.getFullYear()

  const [dueMonth, dueYear] = dueDateStr.split("/").map(Number)
  const diffMonths = (currentYear - dueYear) * 12 + (currentMonth - dueMonth)

  if (diffMonths <= 0) return "Due"
  if (diffMonths === 1) return "Overdue"
  if (diffMonths >= 2) return "Lapsed"

  return "Due"
}

function generatePMDueInfo(startDate, intervalMonths, sequenceNumber) {
  const dueDate = addMonths(startOfMonth(startDate), (sequenceNumber - 1) * intervalMonths)
  return {
    dueDate: toISODateString(dueDate),
    dueMonth: format(dueDate, "MM/yyyy"),
  }
}

function buildNormalizedCustomerMap(customers) {
  const map = new Map()
  customers.forEach((c) => {
    if (c.customercodeid) {
      map.set(String(c.customercodeid).trim().toLowerCase(), c)
    }
  })
  return map
}

function validateRecord(record, lineNumber) {
  const errors = []
  const warnings = []

  const requiredFields = [
    "materialcode",
    "serialnumber",
    "materialdescription",
    "currentcustomer",
    "endcustomer",
    "custWarrantystartdate",
    "custWarrantyenddate",
    // "dealer",
  ]

  // Check required fields
  for (const field of requiredFields) {
    if (!record[field] || String(record[field]).trim() === "") {
      errors.push({
        category: ERROR_CATEGORIES.MISSING_FIELD,
        field,
        message: `Missing required field: ${field}`,
        lineNumber,
      })
    }
  }

  // Validate date fields
  const dateFields = [
    "custWarrantystartdate",
    "custWarrantyenddate",
    "dealerwarrantystartdate",
    "dealerwarrantyenddate",
  ]
  for (const dateField of dateFields) {
    if (record[dateField]) {
      const parsedDate = parseUniversalDate(record[dateField])
      if (!parsedDate) {
        errors.push({
          category: ERROR_CATEGORIES.DATE_FORMAT_ERROR,
          field: dateField,
          message: `Invalid date format in field: ${dateField}`,
          value: record[dateField],
          lineNumber,
        })
      }
    }
  }

  // Validate serial number format
  if (record.serialnumber && record.serialnumber.length < 3) {
    warnings.push({
      field: "serialnumber",
      message: "Serial number seems too short",
      value: record.serialnumber,
      lineNumber,
    })
  }

  return { errors, warnings }
}

async function retryOperation(operation, maxRetries = CONFIG.MAX_RETRIES) {
  let lastError
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt))
      }
    }
  }
  throw lastError
}

function checkMemoryUsage() {
  const usage = process.memoryUsage()
  const totalMemory = require("os").totalmem()
  const usagePercentage = usage.heapUsed / totalMemory

  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    external: Math.round(usage.external / 1024 / 1024),
    usagePercentage: Math.round(usagePercentage * 100),
    threshold: CONFIG.MEMORY_THRESHOLD * 100,
  }
}

// NEW: Memory optimization function
function optimizeMemoryUsage() {
  if (global.gc) {
    global.gc();
  }
}

function cleanupTempFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (error) {
    console.error("Error cleaning up temp file:", error)
  }
}

// Helper function to update job progress
async function updateJobProgress(jobId, updateData) {
  try {
    await JobProgress.findOneAndUpdate({ jobId }, { $set: { ...updateData, updatedAt: new Date() } }, { upsert: false })
  } catch (error) {
    console.error("Error updating job progress:", error)
  }
}

// MAIN PROCESSING FUNCTION - Updated with chunking and optimization
async function processFileAsync(jobId, filePath, fileExtension) {
  let session = null
  const startTime = Date.now()

  const response = {
    status: "processing",
    startTime: new Date(),
    totalRecords: 0,
    processedRecords: 0,
    equipmentResults: [],
    pmResults: [],
    summary: {
      totalPMExpected: 0,
      totalPMCreated: 0,
      pmCompletionPercentage: 0,
      statusBreakdown: { Due: 0, Overdue: 0, Lapsed: 0 },
      pmTypeBreakdown: { WPM: 0, EPM: 0, CPM: 0, NPM: 0 },
      operationBreakdown: { created: 0, updated: 0, skipped: 0, failed: 0, pmRegenerated: 0 },
      errorBreakdown: {},
      statusUpdates: { total: 0, byStatus: {} },
      performance: {
        parseTime: 0,
        validationTime: 0,
        equipmentProcessTime: 0,
        pmProcessTime: 0,
        totalTime: 0,
        memoryUsage: {},
      },
    },
    errors: [],
    warnings: [],
  }

  try {
    console.log(`Starting background processing for job: ${jobId}`)

    // Update status - File Parsing
    await updateJobProgress(jobId, {
      progressPercentage: 10,
      currentOperation: "Parsing and validating file...",
    })

    // Parse file with enhanced error handling
    let parseResult
    const parseStartTime = Date.now()
    try {
      parseResult = await parseFile(filePath, fileExtension)
      response.summary.performance.parseTime = Date.now() - parseStartTime
    } catch (parseError) {
      throw new Error(`File parsing failed: ${parseError.message}`)
    }

    const { records: jsonData, parseTime } = parseResult
    response.totalRecords = jsonData.length

    if (jsonData.length === 0) {
      throw new Error("No valid data found in file")
    }

    console.log(`Parsed ${jsonData.length} records in ${parseTime}ms`)

    await updateJobProgress(jobId, {
      totalRecords: jsonData.length,
      progressPercentage: 20,
      currentOperation: `Found ${jsonData.length} records. Loading reference data...`,
    })

    // Pre-load reference data
    const [materialcodes, customercodes, serialnumbers] = jsonData.reduce(
      (acc, record) => {
        if (record.materialcode) acc[0].add(record.materialcode)
        if (record.currentcustomer) acc[1].add(record.currentcustomer)
        if (record.serialnumber) acc[2].add(record.serialnumber)
        return acc
      },
      [new Set(), new Set(), new Set()],
    )

    const [products, customers, amcContracts, existingEquipment] = await Promise.all([
      Product.find({ partnoid: { $in: [...materialcodes] } }),
      Customer.find({ customercodeid: { $in: [...customercodes] } }),
      AMCContract.find({ serialnumber: { $in: [...serialnumbers] } }),
      Equipment.find({ serialnumber: { $in: [...serialnumbers] } }),
    ])

    const productMap = new Map(products.map((p) => [p.partnoid, p]))
    const customerMap = buildNormalizedCustomerMap(customers)
    const amcMap = new Map(amcContracts.map((a) => [a.serialnumber, a]))
    const existingEquipmentMap = new Map(existingEquipment.map((e) => [e.serialnumber, e]))

    console.log(
      `Loaded reference data: ${products.length} products, ${customers.length} customers, ${amcContracts.length} AMCs, ${existingEquipment.length} existing equipment`,
    )

    await updateJobProgress(jobId, {
      progressPercentage: 30,
      currentOperation: "Validating and processing records...",
    })

    // Validate and process records
    const validationStartTime = Date.now()
    const validRecords = []
    const recordsToUpdate = []
    const recordsToCreate = []
    const recordsForPMGeneration = []
    const processedSerials = new Set()

    for (let i = 0; i < jsonData.length; i++) {
      const record = jsonData[i]
      const lineNumber = i + 2

      // Enhanced progress update with memory monitoring
      if (i % 100 === 0) {
        const progressPercentage = 30 + Math.round((i / jsonData.length) * 30) // 30-60%

        // Check memory usage and cleanup if needed
        const memUsage = checkMemoryUsage();
        if (memUsage.usagePercentage > 70) {
          console.log(`High memory usage detected: ${memUsage.usagePercentage}%. Running cleanup.`);
          optimizeMemoryUsage();
        }

        await updateJobProgress(jobId, {
          processedRecords: i,
          progressPercentage,
          currentOperation: `Processing record ${i + 1} of ${jsonData.length}... (Memory: ${memUsage.heapUsed}MB)`,
        })
      }

      // Check for duplicate serial in file
      if (processedSerials.has(record.serialnumber)) {
        response.equipmentResults.push({
          serialnumber: record.serialnumber,
          lineNumber,
          status: "Failed",
          reason: "Duplicate serial number in uploaded file",
          category: ERROR_CATEGORIES.DUPLICATE_RECORD,
          error: "Serial number appears multiple times in the file",
          pmResults: [],
        })
        response.summary.operationBreakdown.failed++
        continue
      }

      // Validate record
      const validation = validateRecord(record, lineNumber)
      if (validation.errors.length > 0) {
        const primaryError = validation.errors[0]
        response.equipmentResults.push({
          serialnumber: record.serialnumber || "Unknown",
          lineNumber,
          status: "Failed",
          reason: primaryError.message,
          category: primaryError.category,
          allErrors: validation.errors,
          warnings: validation.warnings,
          pmResults: [],
        })
        response.summary.operationBreakdown.failed++

        if (!response.summary.errorBreakdown[primaryError.category]) {
          response.summary.errorBreakdown[primaryError.category] = 0
        }
        response.summary.errorBreakdown[primaryError.category]++
        continue
      }

      if (validation.warnings.length > 0) {
        response.warnings.push(...validation.warnings)
      }

      try {
        const processedRecord = { ...record }

        // Process date fields
        const dateFields = [
          "custWarrantystartdate",
          "custWarrantyenddate",
          "dealerwarrantystartdate",
          "dealerwarrantyenddate",
        ]
        dateFields.forEach((field) => {
          if (processedRecord[field]) {
            const parsedDate = parseUniversalDate(processedRecord[field])
            processedRecord[field] = parsedDate ? toISODateString(parsedDate) : null
          }
        })

        const existingRecord = existingEquipmentMap.get(processedRecord.serialnumber)

        if (existingRecord) {
          // Update existing equipment
          if (!processedRecord.status || processedRecord.status.toString().trim() === "") {
            processedRecord.status = existingRecord.status
          }

          processedRecord.equipmentid = existingRecord.equipmentid
          processedRecord.createdAt = existingRecord.createdAt
          processedRecord.modifiedAt = new Date()

          const changeAnalysis = getDetailedChanges(existingRecord.toObject(), processedRecord)

          if (changeAnalysis.hasChanges) {
            recordsToUpdate.push(processedRecord)
            recordsForPMGeneration.push(processedRecord)

            response.equipmentResults.push({
              serialnumber: processedRecord.serialnumber,
              equipmentid: processedRecord.equipmentid,
              lineNumber,
              status: "Updated",
              reason: "Data changes detected",
              category: "UPDATE",
              changedFields: Object.keys(changeAnalysis.changes),
              detailedChanges: changeAnalysis.changes,
              changeCount: Object.keys(changeAnalysis.changes).length,
              previousModified: existingRecord.modifiedAt,
              willGeneratePMs: true,
              pmResults: [],
            })
            response.summary.operationBreakdown.updated++
          } else {
            recordsForPMGeneration.push(processedRecord)

            response.equipmentResults.push({
              serialnumber: processedRecord.serialnumber,
              equipmentid: existingRecord.equipmentid,
              lineNumber,
              status: "PM_Regenerated",
              reason: "No equipment changes but PMs will be regenerated",
              category: "PM_REGEN",
              lastModified: existingRecord.modifiedAt,
              willGeneratePMs: true,
              pmResults: [],
            })
            response.summary.operationBreakdown.pmRegenerated++
          }
        } else {
          // Create new equipment
          processedRecord.equipmentid = processedRecord.serialnumber
          if (!processedRecord.status || processedRecord.status.toString().trim() === "") {
            processedRecord.status = "Active"
          }
          processedRecord.createdAt = new Date()
          processedRecord.modifiedAt = new Date()

          recordsToCreate.push(processedRecord)
          recordsForPMGeneration.push(processedRecord)

          response.equipmentResults.push({
            serialnumber: processedRecord.serialnumber,
            equipmentid: processedRecord.equipmentid,
            lineNumber,
            status: "Created",
            reason: "New equipment record",
            category: "CREATE",
            willGeneratePMs: true,
            assignedStatus: processedRecord.status,
            pmResults: [],
          })
          response.summary.operationBreakdown.created++
        }

        validRecords.push(processedRecord)
        processedSerials.add(processedRecord.serialnumber)
      } catch (error) {
        response.equipmentResults.push({
          serialnumber: record.serialnumber || "Unknown",
          lineNumber,
          status: "Failed",
          reason: "Processing error",
          category: ERROR_CATEGORIES.DATABASE_ERROR,
          error: error.message,
          pmResults: [],
        })
        response.summary.operationBreakdown.failed++
      }
    }

    response.summary.performance.validationTime = Date.now() - validationStartTime
    console.log(`Validated ${jsonData.length} records in ${response.summary.performance.validationTime}ms`)

    await updateJobProgress(jobId, {
      processedRecords: jsonData.length,
      progressPercentage: 60,
      currentOperation: "Saving equipment records to database...",
      createdCount: response.summary.operationBreakdown.created,
      updatedCount: response.summary.operationBreakdown.updated,
      failedCount: response.summary.operationBreakdown.failed,
    })

    // Start database transaction
    session = await mongoose.startSession()
    const equipmentProcessStartTime = Date.now()

    await session.withTransaction(async () => {
      // Process equipment creation
      if (recordsToCreate.length > 0) {
        console.log(`Creating ${recordsToCreate.length} new equipment records`)

        for (let i = 0; i < recordsToCreate.length; i += CONFIG.EQUIPMENT_BATCH_SIZE) {
          const batch = recordsToCreate.slice(i, i + CONFIG.EQUIPMENT_BATCH_SIZE)

          try {
            await retryOperation(async () => {
              await Equipment.insertMany(batch, { session, ordered: false })
            })
          } catch (bulkError) {
            if (bulkError.writeErrors) {
              bulkError.writeErrors.forEach((err) => {
                const index = err.index
                if (batch[index]) {
                  const serialnumber = batch[index].serialnumber
                  const errorResult = response.equipmentResults.find((r) => r.serialnumber === serialnumber)
                  if (errorResult) {
                    errorResult.status = "Failed"
                    errorResult.reason = "Database write error"
                    errorResult.category = ERROR_CATEGORIES.DATABASE_ERROR
                    errorResult.error = err.errmsg || "Database write error"
                    errorResult.willGeneratePMs = false
                    response.summary.operationBreakdown.failed++
                    response.summary.operationBreakdown.created--
                  }
                }
              })
            }
          }
        }
      }

      // Process equipment updates
      if (recordsToUpdate.length > 0) {
        console.log(`Updating ${recordsToUpdate.length} existing equipment records`)

        for (let i = 0; i < recordsToUpdate.length; i += CONFIG.EQUIPMENT_BATCH_SIZE) {
          const batch = recordsToUpdate.slice(i, i + CONFIG.EQUIPMENT_BATCH_SIZE)
          const equipmentOps = batch.map((record) => ({
            updateOne: {
              filter: { serialnumber: record.serialnumber },
              update: { $set: record },
            },
          }))

          try {
            await retryOperation(async () => {
              await Equipment.bulkWrite(equipmentOps, { session, ordered: false })
            })
          } catch (bulkError) {
            if (bulkError.writeErrors) {
              bulkError.writeErrors.forEach((err) => {
                const index = err.index
                if (batch[index]) {
                  const serialnumber = batch[index].serialnumber
                  const errorResult = response.equipmentResults.find((r) => r.serialnumber === serialnumber)
                  if (errorResult) {
                    errorResult.status = "Failed"
                    errorResult.reason = "Database update error"
                    errorResult.category = ERROR_CATEGORIES.DATABASE_ERROR
                    errorResult.error = err.errmsg || "Database update error"
                    errorResult.willGeneratePMs = false
                    response.summary.operationBreakdown.failed++
                    response.summary.operationBreakdown.updated--
                  }
                }
              })
            }
          }
        }
      }
    })

    response.summary.performance.equipmentProcessTime = Date.now() - equipmentProcessStartTime

    await updateJobProgress(jobId, {
      progressPercentage: 75,
      currentOperation: "Generating PM schedules...",
      createdCount: response.summary.operationBreakdown.created,
      updatedCount: response.summary.operationBreakdown.updated,
      failedCount: response.summary.operationBreakdown.failed,
    })

    // Generate PMs with enhanced memory management
    console.log(`Starting PM generation for ${recordsForPMGeneration.length} records`)
    const pmProcessStartTime = Date.now()

    if (recordsForPMGeneration.length > 0) {
      const serialsForPMGeneration = recordsForPMGeneration.map((r) => r.serialnumber)

      // Get completed PMs to avoid duplicates
      const completedPMs = await PM.find({
        serialNumber: { $in: serialsForPMGeneration },
        pmStatus: "Completed",
      })

      const completedPMMap = new Map()
      completedPMs.forEach((pm) => {
        if (!completedPMMap.has(pm.serialNumber)) {
          completedPMMap.set(pm.serialNumber, new Set())
        }
        completedPMMap.get(pm.serialNumber).add(pm.pmType)
      })

      // Remove old non-completed PMs
      await PM.deleteMany({
        serialNumber: { $in: serialsForPMGeneration },
        pmStatus: { $ne: "Completed" },
      })

      console.log(`Deleted old PMs for ${serialsForPMGeneration.length} serials`)

      const allPMs = []

      for (let recordIndex = 0; recordIndex < recordsForPMGeneration.length; recordIndex++) {
        const record = recordsForPMGeneration[recordIndex];

        if (recordIndex % CONFIG.FORCE_GC_INTERVAL === 0 && recordIndex > 0) {
          aggressiveMemoryCleanup();
        }

        if (recordIndex % 50 === 0) {
          const progressPercentage = 75 + Math.round((recordIndex / recordsForPMGeneration.length) * 15);

          const memUsage = checkMemoryUsage();
          if (memUsage.usagePercentage > 60) { // Reduced threshold
            console.log(`High memory usage detected: ${memUsage.usagePercentage}%. Running cleanup.`);
            aggressiveMemoryCleanup();
          }


          await updateJobProgress(jobId, {
            progressPercentage,
            currentOperation: `Generating PMs: ${recordIndex + 1}/${recordsForPMGeneration.length}... (Memory: ${memUsage.heapUsed}MB)`,
          });
        }

        // Batch process monitoring
        if (recordIndex % 1000 === 0 && recordIndex > 0) {
          console.log(`Processed ${recordIndex}/${recordsForPMGeneration.length} records for PM generation. Memory usage: ${checkMemoryUsage().heapUsed}MB`);
        }

        const equipmentResult = response.equipmentResults.find((r) => r.serialnumber === record.serialnumber)

        try {
          const serialnumber = record.serialnumber
          const product = productMap.get(record.materialcode)

          if (!product || !product.frequency) {
            const warning = `No product frequency found for serial ${serialnumber} - materialcode: ${record.materialcode}`
            response.warnings.push(warning)
            if (equipmentResult) {
              equipmentResult.pmResults.push({
                status: "Skipped",
                reason: "Product frequency not found",
                category: ERROR_CATEGORIES.FOREIGN_KEY_ERROR,
              })
            }
            continue
          }

          const customerCode = String(record.currentcustomer || "")
            .trim()
            .toLowerCase()
          const customer = customerMap.get(customerCode)
          const amc = amcMap.get(serialnumber)
          const frequencyMonths = getPMFrequencyMonths(product.frequency)

          // Generate Customer Warranty PMs
          if (record.custWarrantystartdate && record.custWarrantyenddate) {
            const startDate = parseUniversalDate(record.custWarrantystartdate)
            const endDate = parseUniversalDate(record.custWarrantyenddate)

            if (startDate && endDate) {
              const totalMonths = differenceInMonths(endDate, startDate) + 1
              const numberOfPMs = Math.floor(totalMonths / frequencyMonths)
              response.summary.totalPMExpected += numberOfPMs

              for (let i = 1; i <= numberOfPMs; i++) {
                const pmType = `WPM${String(i).padStart(2, "0")}`
                if (completedPMMap.has(serialnumber) && completedPMMap.get(serialnumber).has(pmType)) {
                  if (equipmentResult) {
                    equipmentResult.pmResults.push({
                      pmType,
                      status: "Skipped",
                      reason: "Already completed",
                      category: "COMPLETED",
                    })
                  }
                  continue
                }

                const { dueDate, dueMonth } = generatePMDueInfo(startDate, frequencyMonths, i)
                const pmStatus = calculatePMStatus(dueMonth)

                allPMs.push({
                  pmType,
                  materialDescription: record.materialdescription || "",
                  serialNumber: serialnumber,
                  customerCode: record.currentcustomer || "",
                  region: customer?.region || "",
                  city: customer?.city || "",
                  branch: customer?.branch || "",
                  pmDueDate: dueDate,
                  pmDueMonth: dueMonth,
                  pmStatus,
                  partNumber: record.materialcode || "",
                  frequency: frequencyMonths,
                  equipmentId: record.equipmentid,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })

                response.summary.statusBreakdown[pmStatus]++
                response.summary.pmTypeBreakdown.WPM++

                if (equipmentResult) {
                  equipmentResult.pmResults.push({
                    pmType,
                    dueMonth,
                    dueDate,
                    status: "Created",
                    pmStatus,
                    reason: null,
                    category: "CREATE",
                  })
                }
              }
            }
          }

          // Generate Extended/Dealer Warranty PMs
          if (record.dealerwarrantystartdate && record.dealerwarrantyenddate) {
            const startDate = parseUniversalDate(record.dealerwarrantystartdate)
            const endDate = parseUniversalDate(record.dealerwarrantyenddate)

            if (startDate && endDate) {
              const totalMonths = differenceInMonths(endDate, startDate) + 1
              const numberOfPMs = Math.floor(totalMonths / frequencyMonths)
              response.summary.totalPMExpected += numberOfPMs

              for (let i = 1; i <= numberOfPMs; i++) {
                const pmType = `EPM${String(i).padStart(2, "0")}`
                if (completedPMMap.has(serialnumber) && completedPMMap.get(serialnumber).has(pmType)) {
                  if (equipmentResult) {
                    equipmentResult.pmResults.push({
                      pmType,
                      status: "Skipped",
                      reason: "Already completed",
                      category: "COMPLETED",
                    })
                  }
                  continue
                }

                const { dueDate, dueMonth } = generatePMDueInfo(startDate, frequencyMonths, i)
                const pmStatus = calculatePMStatus(dueMonth)

                allPMs.push({
                  pmType,
                  materialDescription: record.materialdescription || "",
                  serialNumber: serialnumber,
                  customerCode: record.currentcustomer || "",
                  region: customer?.region || "",
                  city: customer?.city || "",
                  branch: customer?.branch || "",
                  pmDueDate: dueDate,
                  pmDueMonth: dueMonth,
                  pmStatus,
                  partNumber: record.materialcode || "",
                  frequency: frequencyMonths,
                  equipmentId: record.equipmentid,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })

                response.summary.statusBreakdown[pmStatus]++
                response.summary.pmTypeBreakdown.EPM++

                if (equipmentResult) {
                  equipmentResult.pmResults.push({
                    pmType,
                    dueMonth,
                    dueDate,
                    status: "Created",
                    pmStatus,
                    reason: null,
                    category: "CREATE",
                  })
                }
              }
            }
          }

          // Generate AMC Contract PMs
          if (amc && amc.startdate && amc.enddate) {
            const startDate = parseUniversalDate(amc.startdate)
            const endDate = parseUniversalDate(amc.enddate)

            if (startDate && endDate) {
              let pmPrefix = ""
              if (amc.satypeZDRC_ZDRN?.toUpperCase() === "ZDRC") pmPrefix = "CPM"
              else if (amc.satypeZDRC_ZDRN?.toUpperCase() === "ZDRN") pmPrefix = "NPM"

              if (pmPrefix) {
                const totalMonths = differenceInMonths(endDate, startDate) + 1
                const numberOfPMs = Math.floor(totalMonths / frequencyMonths)
                response.summary.totalPMExpected += numberOfPMs

                for (let i = 1; i <= numberOfPMs; i++) {
                  const pmType = `${pmPrefix}${String(i).padStart(2, "0")}`
                  if (completedPMMap.has(serialnumber) && completedPMMap.get(serialnumber).has(pmType)) {
                    if (equipmentResult) {
                      equipmentResult.pmResults.push({
                        pmType,
                        status: "Skipped",
                        reason: "Already completed",
                        category: "COMPLETED",
                      })
                    }
                    continue
                  }

                  const { dueDate, dueMonth } = generatePMDueInfo(startDate, frequencyMonths, i)
                  const pmStatus = calculatePMStatus(dueMonth)

                  allPMs.push({
                    pmType,
                    materialDescription: record.materialdescription || "",
                    serialNumber: serialnumber,
                    customerCode: record.currentcustomer || "",
                    region: customer?.region || "",
                    city: customer?.city || "",
                    branch: customer?.branch || "",
                    pmDueDate: dueDate,
                    pmDueMonth: dueMonth,
                    pmStatus,
                    partNumber: record.materialcode || "",
                    frequency: frequencyMonths,
                    equipmentId: record.equipmentid,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  })

                  response.summary.statusBreakdown[pmStatus]++
                  if (pmPrefix === "CPM") response.summary.pmTypeBreakdown.CPM++
                  if (pmPrefix === "NPM") response.summary.pmTypeBreakdown.NPM++

                  if (equipmentResult) {
                    equipmentResult.pmResults.push({
                      pmType,
                      dueMonth,
                      dueDate,
                      status: "Created",
                      pmStatus,
                      reason: null,
                      category: "CREATE",
                    })
                  }
                }
              }
            }
          }
        } catch (pmError) {
          console.error(`PM generation error for ${record.serialnumber}:`, pmError)
          response.errors.push({
            category: ERROR_CATEGORIES.BUSINESS_RULE_ERROR,
            message: `PM generation error for ${record.serialnumber}: ${pmError.message}`,
            serialnumber: record.serialnumber,
            timestamp: new Date(),
          })

          if (equipmentResult) {
            equipmentResult.pmResults.push({
              status: "Failed",
              reason: "PM generation error",
              category: ERROR_CATEGORIES.BUSINESS_RULE_ERROR,
              error: pmError.message,
            })
          }
        }
      }

      console.log(`Generated ${allPMs.length} PM tasks for insertion`)

      await updateJobProgress(jobId, {
        progressPercentage: 90,
        currentOperation: `Saving ${allPMs.length} PM schedules to database...`,
      })

      // Insert PMs in batches
      let pmInsertedCount = 0
      for (let i = 0; i < allPMs.length; i += CONFIG.PM_BATCH_SIZE) {
        const pmBatch = allPMs.slice(i, i + CONFIG.PM_BATCH_SIZE)
        try {
          const insertedPMs = await retryOperation(async () => {
            return await PM.insertMany(pmBatch, { ordered: false })
          })
          pmInsertedCount += insertedPMs.length
        } catch (insertError) {
          console.error("PM insert error:", insertError)
          response.errors.push({
            category: ERROR_CATEGORIES.DATABASE_ERROR,
            message: `PM batch insert error: ${insertError.message}`,
            batchSize: pmBatch.length,
            timestamp: new Date(),
          })

          pmBatch.forEach((pm) => {
            const equipmentResult = response.equipmentResults.find((r) => r.serialnumber === pm.serialNumber)
            if (equipmentResult) {
              const pmResult = equipmentResult.pmResults.find((p) => p.pmType === pm.pmType)
              if (pmResult) {
                pmResult.status = "Failed"
                pmResult.reason = "Database insert error"
                pmResult.category = ERROR_CATEGORIES.DATABASE_ERROR
                pmResult.error = insertError.message
              }
            }
          })
        }
      }

      response.summary.totalPMCreated = pmInsertedCount
      console.log(`Successfully inserted ${pmInsertedCount} PM tasks out of ${allPMs.length} generated`)
    }

    response.summary.performance.pmProcessTime = Date.now() - pmProcessStartTime

    // Track status updates
    const statusUpdates = response.equipmentResults.filter((r) => r.detailedChanges && r.detailedChanges.status)

    response.summary.statusUpdates.total = statusUpdates.length
    statusUpdates.forEach((update) => {
      const newStatus = update.detailedChanges.status.new
      if (!response.summary.statusUpdates.byStatus[newStatus]) {
        response.summary.statusUpdates.byStatus[newStatus] = 0
      }
      response.summary.statusUpdates.byStatus[newStatus]++
    })

    response.processedRecords = jsonData.length

    // Calculate completion percentage
    response.summary.pmCompletionPercentage =
      response.summary.totalPMExpected > 0
        ? Math.round((response.summary.totalPMCreated / response.summary.totalPMExpected) * 100)
        : 100

    // Final performance metrics
    response.summary.performance.totalTime = Date.now() - startTime
    response.summary.performance.memoryUsage = checkMemoryUsage()

    response.status = "completed"
    response.endTime = new Date()
    response.duration = `${Math.round(response.summary.performance.totalTime / 1000)}s`

    // FIXED: Save final results using chunking strategy to avoid BSON limit
    console.log(`Saving results for job ${jobId}: ${response.equipmentResults.length} equipment results`);

    await saveJobResultsInChunks(
      jobId,
      response.equipmentResults,
      response.pmResults,
      response.summary,
      response.errors,
      response.warnings
    );

    console.log(`Successfully saved all results for job ${jobId}`);

    // Update final job progress
    await updateJobProgress(jobId, {
      status: "COMPLETED",
      progressPercentage: 100,
      currentOperation: "Processing completed successfully!",
      endTime: new Date(),
      pmCount: response.summary.totalPMCreated,
      createdCount: response.summary.operationBreakdown.created,
      updatedCount: response.summary.operationBreakdown.updated,
      failedCount: response.summary.operationBreakdown.failed,
    })

    console.log(`Background processing completed for job ${jobId}`)
  } catch (error) {
    console.error(`Background processing failed for job ${jobId}:`, error)

    // Update job status to failed
    await updateJobProgress(jobId, {
      status: "FAILED",
      endTime: new Date(),
      errorMessage: error.message,
      errorSummary: [
        {
          category: ERROR_CATEGORIES.DATABASE_ERROR,
          message: error.message,
          timestamp: new Date(),
        },
      ],
    })
  } finally {
    // Cleanup
    if (session) {
      await session.endSession()
    }

    if (filePath) {
      cleanupTempFile(filePath)
    }

    const finalMemUsage = checkMemoryUsage()
    console.log(`Final memory usage for job ${jobId}: ${finalMemUsage.heapUsed}MB (${finalMemUsage.usagePercentage}%)`)
  }
}

// API Routes (keeping all existing routes)
router.post("/start", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
        error: "FILE_MISSING",
      })
    }

    // Generate unique job ID
    const jobId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const fileExtension = path.extname(req.file.originalname).toLowerCase()

    // Initial field mapping analysis
    let detectedFields = []
    let mappedFields = []
    let unmappedFields = []

    try {
      // Quick parse for field detection
      const sampleResult = await parseFile(req.file.path, fileExtension)
      if (sampleResult.records.length > 0) {
        const firstRecord = sampleResult.records[0]
        detectedFields = Object.keys(firstRecord)
        mappedFields = detectedFields.filter((key) =>
          Object.values(FIELD_MAPPINGS).some((variations) =>
            variations.some(
              (variation) =>
                key.toLowerCase().trim() === variation.toLowerCase() ||
                key.toLowerCase().replace(/[_\s\-.]/g, "") === variation.toLowerCase().replace(/[_\s\-.]/g, ""),
            ),
          ),
        )
        unmappedFields = detectedFields.filter((field) => !mappedFields.includes(field))
      }
    } catch (parseError) {
      console.error("Quick parse error:", parseError)
    }

    // Save initial job progress in database
    await JobProgress.create({
      jobId,
      status: "PROCESSING",
      fileName: req.file.originalname,
      fileSize: Math.round((req.file.size / 1024 / 1024) * 100) / 100, // MB
      totalRecords: 0,
      processedRecords: 0,
      createdCount: 0,
      updatedCount: 0,
      failedCount: 0,
      pmCount: 0,
      progressPercentage: 5,
      currentOperation: "File uploaded. Starting validation...",
      startTime: new Date(),
      estimatedEndTime: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes estimate
      fieldMappingInfo: {
        detectedFields,
        mappedFields,
        unmappedFields,
      },
    })

    // Start background processing (don't await)
    processFileAsync(jobId, req.file.path, fileExtension).catch((error) => {
      console.error(`Background processing failed for job ${jobId}:`, error)
    })

    // Immediate response to frontend
    res.status(202).json({
      // 202 = Accepted
      success: true,
      jobId,
      message: "File upload started. Processing in background.",
      fileInfo: {
        name: req.file.originalname,
        size: `${Math.round((req.file.size / 1024 / 1024) * 100) / 100} MB`,
        type: fileExtension.toUpperCase(),
      },
      fieldMapping: {
        detected: detectedFields.length,
        mapped: mappedFields.length,
        unmapped: unmappedFields.length,
      },
      statusUrl: `/api/bulk-upload/status/${jobId}`,
      estimatedTime: "2-5 minutes",
      pollingInterval: "Check status every 3-5 seconds",
    })
  } catch (error) {
    console.error("Bulk upload start error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to start bulk upload",
      error: error.message,
    })
  }
})

// UPDATED: Status endpoint with proper chunked data handling
router.get("/status/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Reduced max limit
    const type = req.query.type || "summary";

    const jobProgress = await JobProgress.findOne({ jobId });

    if (!jobProgress) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
        error: "JOB_NOT_FOUND",
      });
    }

    const response = {
      success: true,
      jobId,
      status: jobProgress.status,
      progress: {
        percentage: jobProgress.progressPercentage,
        totalRecords: jobProgress.totalRecords,
        processedRecords: jobProgress.processedRecords,
        currentOperation: jobProgress.currentOperation,
      },
      counts: {
        created: jobProgress.createdCount,
        updated: jobProgress.updatedCount,
        failed: jobProgress.failedCount,
        pmGenerated: jobProgress.pmCount,
      },
      timing: {
        startTime: jobProgress.startTime,
        endTime: jobProgress.endTime,
        duration: jobProgress.endTime ? Math.round((jobProgress.endTime - jobProgress.startTime) / 1000) : null,
        elapsedTime: Math.round((new Date() - jobProgress.startTime) / 1000),
      },
      fileInfo: {
        name: jobProgress.fileName,
        size: `${jobProgress.fileSize} MB`,
      },
    };

    if (jobProgress.status === "COMPLETED" && type !== "summary") {
      // FIXED: Use optimized getJobResults function
      const results = await getJobResults(jobId, type, page, limit);
      response.data = results.data;
      response.pagination = results.pagination;

      // Add chunk info for debugging
      const mainJobResult = await JobResult.findOne({ jobId, isChunk: { $ne: true } });
      if (mainJobResult && mainJobResult.totalChunks) {
        response.chunkInfo = {
          totalChunks: mainJobResult.totalChunks,
          totalEquipmentResults: mainJobResult.totalEquipmentResults,
          isChunked: true
        };
      }
    }

    res.json(response);
  } catch (error) {
    console.error("Status check error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get job status",
      error: error.message,
    });
  }
});


router.get("/results/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params
    const type = req.query.type || "all"

    // Get job result from database
    const jobResult = await JobResult.findOne({ jobId })

    if (!jobResult) {
      return res.status(404).json({
        success: false,
        message: "Job results not found",
        error: "RESULTS_NOT_FOUND",
      })
    }

    // Extract all errors from equipment results
    const extractAllErrors = (equipmentResults) => {
      const allErrors = []
      const allWarnings = []

      equipmentResults.forEach((equipment, index) => {
        // Add equipment-level errors
        if (equipment.allErrors && equipment.allErrors.length > 0) {
          equipment.allErrors.forEach(error => {
            allErrors.push({
              ...error,
              serialNumber: equipment.serialnumber,
              equipmentId: equipment.equipmentid,
              lineNumber: equipment.lineNumber,
              source: 'equipment',
              recordIndex: index
            });
          });
        }

        // Add equipment-level warnings  
        if (equipment.warnings && equipment.warnings.length > 0) {
          equipment.warnings.forEach(warning => {
            allWarnings.push({
              ...warning,
              serialNumber: equipment.serialnumber,
              equipmentId: equipment.equipmentid,
              lineNumber: equipment.lineNumber,
              source: 'equipment',
              recordIndex: index
            });
          });
        }

        // Add equipment general error if status is Failed
        if (equipment.status === 'Failed' && equipment.error) {
          allErrors.push({
            category: equipment.category || 'ProcessingError',
            field: null,
            message: equipment.error,
            serialNumber: equipment.serialnumber,
            equipmentId: equipment.equipmentid,
            lineNumber: equipment.lineNumber,
            source: 'equipment',
            recordIndex: index
          });
        }

        // Add PM-related errors
        if (equipment.pmResults && equipment.pmResults.length > 0) {
          equipment.pmResults.forEach(pm => {
            if (pm.status === 'Failed' || pm.error) {
              allErrors.push({
                category: pm.category || 'PM_Error',
                field: pm.pmType,
                message: pm.error || pm.reason || 'PM task failed',
                serialNumber: equipment.serialnumber,
                equipmentId: equipment.equipmentid,
                lineNumber: equipment.lineNumber,
                pmType: pm.pmType,
                source: 'pm',
                recordIndex: index
              });
            }
          });
        }
      });

      return { allErrors, allWarnings };
    };

    // Get all errors from equipment results
    const { allErrors: equipmentErrors, allWarnings: equipmentWarnings } =
      extractAllErrors(jobResult.equipmentResults || []);

    // Combine with processing-level errors
    const combinedErrors = [
      ...(jobResult.errors || []).map((error, index) => ({
        id: `proc_${index}`,
        message: typeof error === 'string' ? error : error.message || JSON.stringify(error),
        source: 'processing',
        category: error.category || 'ProcessingError',
        serialNumber: error.serialnumber || null,
        timestamp: error.timestamp || null
      })),
      ...equipmentErrors.map((error, index) => ({
        id: `eq_${index}`,
        ...error
      }))
    ];

    const combinedWarnings = [
      ...(jobResult.warnings || []).map((warning, index) => ({
        id: `proc_warn_${index}`,
        message: typeof warning === 'string' ? warning : warning.message || JSON.stringify(warning),
        source: 'processing',
        category: warning.category || 'ProcessingWarning',
        serialNumber: warning.serialnumber || null
      })),
      ...equipmentWarnings.map((warning, index) => ({
        id: `eq_warn_${index}`,
        ...warning
      }))
    ];

    // Calculate totals
    const allEquipment = jobResult.equipmentResults || [];
    const totals = {
      totalEquipment: allEquipment.length,
      successfulEquipment: allEquipment.filter(eq => eq.status === 'Completed' || eq.status === 'Success').length,
      failedEquipment: allEquipment.filter(eq => eq.status === 'Failed').length,
      equipmentWithWarnings: allEquipment.filter(eq => eq.warnings && eq.warnings.length > 0).length,
      equipmentWithErrors: allEquipment.filter(eq => eq.allErrors && eq.allErrors.length > 0).length,
      totalPMGenerated: allEquipment.reduce((count, eq) => count + (eq.pmResults?.length || 0), 0),
      successfulPM: allEquipment.reduce((count, eq) => count + (eq.pmResults?.filter(pm => pm.status === 'Success' || pm.status === 'Completed').length || 0), 0),
      failedPM: allEquipment.reduce((count, eq) => count + (eq.pmResults?.filter(pm => pm.status === 'Failed').length || 0), 0)
    };

    // Filter data based on type - only show problematic records
    let data = []
    if (type === "equipment") {
      // Only return equipment with errors, warnings, or failed status
      data = allEquipment.filter(equipment =>
        equipment.status === 'Failed' ||
        (equipment.allErrors && equipment.allErrors.length > 0) ||
        (equipment.warnings && equipment.warnings.length > 0)
      );
    } else if (type === "pm") {
      // Only return failed PM results
      const problematicPMs = [];
      allEquipment.forEach(equipment => {
        if (equipment.pmResults && equipment.pmResults.length > 0) {
          equipment.pmResults.forEach(pm => {
            if (pm.status === 'Failed' || pm.error) {
              problematicPMs.push({
                ...pm,
                serialNumber: equipment.serialnumber,
                equipmentId: equipment.equipmentid,
                lineNumber: equipment.lineNumber
              });
            }
          });
        }
      });
      data = problematicPMs;
    } else if (type === "errors") {
      return res.json({
        success: true,
        jobId,
        type: 'errors',
        data: combinedErrors,
        warnings: combinedWarnings,
        totalErrors: combinedErrors.length,
        totalWarnings: combinedWarnings.length,
        totals,
        errorBreakdown: jobResult.summary?.errorBreakdown || {},
        createdAt: jobResult.createdAt,
        updatedAt: jobResult.updatedAt,
      })
    } else if (type === "warnings") {
      return res.json({
        success: true,
        jobId,
        type: 'warnings',
        data: combinedWarnings,
        totalWarnings: combinedWarnings.length,
        totals,
        createdAt: jobResult.createdAt,
        updatedAt: jobResult.updatedAt,
      })
    } else {
      // For "all" type, return equipment with issues
      data = allEquipment.filter(equipment =>
        equipment.status === 'Failed' ||
        (equipment.allErrors && equipment.allErrors.length > 0) ||
        (equipment.warnings && equipment.warnings.length > 0)
      );
    }

    res.json({
      success: true,
      jobId,
      type,
      data: data, // Only problematic records
      total: data.length,
      totals, // Complete statistics
      // Always include error summary for frontend
      errorSummary: {
        totalErrors: combinedErrors.length,
        totalWarnings: combinedWarnings.length,
        errorBreakdown: jobResult.summary?.errorBreakdown || {},
        errorsByCategory: combinedErrors.reduce((acc, error) => {
          acc[error.category] = (acc[error.category] || 0) + 1;
          return acc;
        }, {})
      },
      createdAt: jobResult.createdAt,
      updatedAt: jobResult.updatedAt,
    })
  } catch (error) {
    console.error("Results fetch error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch job results",
      error: error.message,
    })
  }
})



// New dedicated endpoint for errors only
router.get("/errors/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params
    const includeWarnings = req.query.includeWarnings === 'true'

    const jobResult = await JobResult.findOne({ jobId })

    if (!jobResult) {
      return res.status(404).json({
        success: false,
        message: "Job results not found",
        error: "RESULTS_NOT_FOUND",
      })
    }

    // Extract all errors from equipment results
    const extractAllErrors = (equipmentResults) => {
      const allErrors = []
      const allWarnings = []

      equipmentResults.forEach((equipment, index) => {
        // Equipment-level errors
        if (equipment.allErrors && equipment.allErrors.length > 0) {
          equipment.allErrors.forEach(error => {
            allErrors.push({
              id: `eq_${equipment.serialnumber}_${error.field || 'general'}_${index}`,
              category: error.category,
              field: error.field,
              message: error.message,
              serialNumber: equipment.serialnumber,
              equipmentId: equipment.equipmentid,
              lineNumber: equipment.lineNumber,
              source: 'equipment',
              severity: 'error',
              recordIndex: index,
              timestamp: new Date()
            });
          });
        }

        // Equipment general errors
        if (equipment.status === 'Failed' && equipment.reason) {
          allErrors.push({
            id: `eq_${equipment.serialnumber}_general_${index}`,
            category: equipment.category || 'ProcessingError',
            field: null,
            message: equipment.reason,
            serialNumber: equipment.serialnumber,
            equipmentId: equipment.equipmentid,
            lineNumber: equipment.lineNumber,
            source: 'equipment',
            severity: 'error',
            recordIndex: index,
            timestamp: new Date()
          });
        }

        // Equipment warnings
        if (equipment.warnings && equipment.warnings.length > 0) {
          equipment.warnings.forEach(warning => {
            allWarnings.push({
              id: `eq_warn_${equipment.serialnumber}_${warning.field || 'general'}_${index}`,
              category: warning.category || 'ProcessingWarning',
              field: warning.field,
              message: warning.message,
              serialNumber: equipment.serialnumber,
              equipmentId: equipment.equipmentid,
              lineNumber: equipment.lineNumber,
              source: 'equipment',
              severity: 'warning',
              recordIndex: index,
              timestamp: new Date()
            });
          });
        }

        // PM-related errors
        if (equipment.pmResults && equipment.pmResults.length > 0) {
          equipment.pmResults.forEach((pm, pmIndex) => {
            if (pm.status === 'Failed' || pm.error) {
              allErrors.push({
                id: `pm_${equipment.serialnumber}_${pm.pmType}_${pmIndex}`,
                category: pm.category || 'PM_Error',
                field: pm.pmType,
                message: pm.error || pm.reason || 'PM task failed',
                serialNumber: equipment.serialnumber,
                equipmentId: equipment.equipmentid,
                lineNumber: equipment.lineNumber,
                pmType: pm.pmType,
                source: 'pm',
                severity: 'error',
                recordIndex: index,
                timestamp: new Date()
              });
            }
          });
        }
      });

      return { allErrors, allWarnings };
    };

    const { allErrors: equipmentErrors, allWarnings: equipmentWarnings } =
      extractAllErrors(jobResult.equipmentResults || []);

    // Processing-level errors
    const processingErrors = (jobResult.errors || []).map((error, index) => ({
      id: `proc_${index}`,
      category: error.category || 'ProcessingError',
      field: null,
      message: typeof error === 'string' ? error : error.message || JSON.stringify(error),
      serialNumber: error.serialnumber || null,
      equipmentId: null,
      lineNumber: null,
      source: 'processing',
      severity: 'error',
      timestamp: error.timestamp || new Date()
    }));

    const processingWarnings = (jobResult.warnings || []).map((warning, index) => ({
      id: `proc_warn_${index}`,
      category: warning.category || 'ProcessingWarning',
      field: null,
      message: typeof warning === 'string' ? warning : warning.message || JSON.stringify(warning),
      serialNumber: warning.serialnumber || null,
      equipmentId: null,
      lineNumber: null,
      source: 'processing',
      severity: 'warning',
      timestamp: new Date()
    }));

    const allErrors = [...processingErrors, ...equipmentErrors];
    const allWarnings = [...processingWarnings, ...equipmentWarnings];

    // Error breakdown by category
    const errorBreakdown = allErrors.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1;
      return acc;
    }, {});

    // Error breakdown by source
    const errorBySource = allErrors.reduce((acc, error) => {
      acc[error.source] = (acc[error.source] || 0) + 1;
      return acc;
    }, {});

    const response = {
      success: true,
      jobId,
      errors: allErrors,
      totalErrors: allErrors.length,
      errorBreakdown,
      errorBySource,
      failedEquipment: jobResult.equipmentResults?.filter(eq => eq.status === 'Failed').map(eq => ({
        serialNumber: eq.serialnumber,
        equipmentId: eq.equipmentid,
        lineNumber: eq.lineNumber,
        reason: eq.reason,
        category: eq.category,
        errorCount: (eq.allErrors?.length || 0) + (eq.pmResults?.filter(pm => pm.status === 'Failed').length || 0)
      })) || [],
      createdAt: jobResult.createdAt,
      updatedAt: jobResult.updatedAt,
    };

    if (includeWarnings) {
      response.warnings = allWarnings;
      response.totalWarnings = allWarnings.length;
    }

    res.json(response);
  } catch (error) {
    console.error("Errors fetch error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch errors",
      error: error.message,
    })
  }
})

// Keep existing endpoint for backward compatibility (optional)
router.post("/bulk-upload", upload.single("file"), async (req, res) => {
  return res.status(400).json({
    success: false,
    message: "This endpoint is deprecated. Use /start for new uploads.",
    newEndpoint: "/api/equipment/bulk-upload/start",
    statusEndpoint: "/api/equipment/bulk-upload/status/{jobId}",
    resultsEndpoint: "/api/equipment/bulk-upload/results/{jobId}",
  })
})

module.exports = router
