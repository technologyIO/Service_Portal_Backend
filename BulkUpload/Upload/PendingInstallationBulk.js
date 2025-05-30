const express = require('express');
const { parse, isValid } = require('date-fns');
const XLSX = require('xlsx');
const multer = require('multer');
const router = express.Router();
const PendingInstallation = require('../../Model/UploadSchema/PendingInstallationSchema');
const Customer = require('../../Model/UploadSchema/CustomerSchema');

// Configure multer with memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

/** Universal date parser supporting multiple formats and Excel serials */
function parseUniversalDate(dateInput) {
  if (!dateInput) return null;

  if (dateInput instanceof Date && !isNaN(dateInput)) {
    return dateInput;
  }

  if (typeof dateInput === 'number') {
    try {
      const excelDate = XLSX.SSF.parse_date_code(dateInput);
      return new Date(excelDate.y, excelDate.m - 1, excelDate.d);
    } catch (e) {
      return null;
    }
  }

  const formats = [
    'dd/MM/yyyy', 'dd-MM-yyyy', 'dd.MM.yyyy',
    'MM/dd/yyyy', 'MM-dd-yyyy', 'MM.dd.yyyy',
    'yyyy/MM/dd', 'yyyy-MM-dd', 'yyyy.MM.dd',
    'd/M/yyyy', 'd-M-yyyy', 'd.M.yyyy',
    'M/d/yyyy', 'M-d-yyyy', 'M.d.yyyy',
    'dd/MM/yy', 'dd-MM-yy', 'dd.MM.yy'
  ];

  for (const format of formats) {
    try {
      const parsedDate = parse(dateInput.toString(), format, new Date());
      if (isValid(parsedDate)) {
        return parsedDate;
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  // Initialize response object with streaming support
  const response = {
    status: 'processing',
    startTime: new Date(),
    totalRecords: 0,
    processedRecords: 0,
    successCount: 0,
    errorCount: 0,
    currentRecord: null,
    errors: [],
    message: 'Starting processing'
  };

  try {
    if (!req.file) {
      response.status = 'failed';
      response.errors.push('No file uploaded');
      return res.status(400).json(response);
    }

    // Set headers for streaming response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Read and parse Excel file
    const workbook = XLSX.read(req.file.buffer, {
      type: 'buffer',
      cellDates: true,
      dateNF: 'dd"/"mm"/"yyyy;@'
    });
    
    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
    response.totalRecords = jsonData.length;
    response.message = `Found ${response.totalRecords} records to process`;

    // Send initial response
    res.write(JSON.stringify(response) + '\n');

    // Pre-fetch customer data for optimization
    const customerIds = [...new Set(jsonData.map(r => r.customerid))];
    const currentCustomerIds = [...new Set(jsonData.map(r => r.currentcustomerid))];
    const allCustomerIds = [...new Set([...customerIds, ...currentCustomerIds])];
    
    const customers = await Customer.find({
      $or: [
        { customercodeid: { $in: allCustomerIds } },
        { email: { $in: allCustomerIds } }
      ]
    });
    
    const customerMap = new Map();
    customers.forEach(c => {
      customerMap.set(c.customercodeid, c);
      if (c.email) customerMap.set(c.email, c);
    });

    // Process records in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
      const batch = jsonData.slice(i, i + BATCH_SIZE);

      for (const [index, record] of batch.entries()) {
        const absoluteIndex = i + index;
        response.currentRecord = {
          serialnumber: record.serialnumber || 'Unknown',
          invoiceno: record.invoiceno || 'Unknown',
          index: absoluteIndex + 1
        };
        response.processedRecords = absoluteIndex + 1;
        response.message = `Processing record ${absoluteIndex + 1} of ${response.totalRecords}`;

        try {
          // Validate required fields
          const requiredFields = [
            'invoiceno', 'invoicedate', 'distchnl', 'customerid',
            'material', 'description', 'serialnumber',
            'salesdist', 'salesoff', 'currentcustomerid', 'mtl_grp4'
          ];

          const missingFields = requiredFields.filter(field => !record[field]);
          if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
          }

          // Get customer data
          const customer = customerMap.get(record.customerid) || {};
          const currentCustomer = customerMap.get(record.currentcustomerid) || {};

          // Prepare document
          const doc = {
            invoiceno: record.invoiceno,
            invoicedate: parseUniversalDate(record.invoicedate),
            distchnl: record.distchnl,
            customerid: record.customerid,
            material: record.material,
            description: record.description,
            serialnumber: record.serialnumber,
            salesdist: record.salesdist,
            salesoff: record.salesoff,
            currentcustomerid: record.currentcustomerid,
            mtl_grp4: record.mtl_grp4,
            key: record.key || '',
            palnumber: record.palnumber || '',
            status: ['Active', 'Deactive'].includes(record.status) ? record.status : 'Active',
            // Customer fields
            customername1: customer.customername || '',
            customername2: customer.hospitalname || '',
            customercity: customer.city || '',
            customerpostalcode: customer.postalcode || '',
            customercountry: customer.country || '',
            customerregion: customer.region || '',
            // Current customer fields
            currentcustomername1: currentCustomer.customername || '',
            currentcustomername2: currentCustomer.hospitalname || '',
            currentcustomercity: currentCustomer.city || '',
            currentcustomerpostalcode: currentCustomer.postalcode || '',
            currentcustomercountry: currentCustomer.country || '',
            currentcustomerregion: currentCustomer.region || ''
          };

          // Upsert document
          await PendingInstallation.findOneAndUpdate(
            { serialnumber: doc.serialnumber },
            { $set: doc },
            { upsert: true, runValidators: true }
          );

          response.successCount++;
        } catch (error) {
          response.errorCount++;
          response.errors.push({
            record: record.invoiceno || 'Unknown',
            serialnumber: record.serialnumber || 'Unknown',
            error: error.message
          });
        }

        // Send progress update after each record
        res.write(JSON.stringify(response) + '\n');
      }
    }

    // Finalize response
    response.status = 'completed';
    response.endTime = new Date();
    response.duration = `${((response.endTime - response.startTime) / 1000).toFixed(2)}s`;
    response.message = `Processing completed. Success: ${response.successCount}, Errors: ${response.errorCount}`;
    
    res.write(JSON.stringify(response) + '\n');
    res.end();

  } catch (error) {
    console.error('Bulk upload error:', error);
    
    // If headers were already sent, try to send the error as the last chunk
    if (res.headersSent) {
      response.status = 'failed';
      response.endTime = new Date();
      response.duration = `${((response.endTime - response.startTime) / 1000).toFixed(2)}s`;
      response.errors.push(error.message);
      response.message = 'Processing failed due to unexpected error';
      
      res.write(JSON.stringify(response) + '\n');
      res.end();
    } else {
      // If headers weren't sent, send a normal error response
      response.status = 'failed';
      response.endTime = new Date();
      response.duration = `${((response.endTime - response.startTime) / 1000).toFixed(2)}s`;
      response.errors.push(error.message);
      response.message = 'Processing failed due to unexpected error';
      
      res.status(500).json(response);
    }
  }
});

module.exports = router;