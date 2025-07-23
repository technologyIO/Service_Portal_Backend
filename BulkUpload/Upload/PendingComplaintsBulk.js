
const express = require('express');
const XLSX = require('xlsx');
const csv = require('csv-parser');
const multer = require('multer');
const { Readable } = require('stream');

const router = express.Router();

const PendingComplaints = require(
  '../../Model/UploadSchema/PendingCompliantsSchema'
);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv', 'application/csv'
    ];
    if (
      ok.includes(file.mimetype) ||
      /\.(csv|xlsx?|xls)$/i.test(file.originalname)
    ) return cb(null, true);

    cb(
      new Error('Only Excel (.xlsx/.xls) or CSV files are accepted'),
      false
    );
  },
  limits: { fileSize: 50 * 1024 * 1024 }        // 50 MB
});


const normalize = s =>
  (s || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();

/* ---------------------------------- mapHeaders */
function mapHeaders(headers) {
  // Map every header in the sheet → internal field
  const dictionary = {
    notificationtype: ['notificationtype', 'notification type', 'type'],
    notification_complaintid: [
      'notificationcomplaintid', 'notification/complaint id',
      'complaintid', 'ticketid'
    ],
    notificationdate: ['notificationdate', 'notification date', 'date'],
    userstatus: ['userstatus', 'user status', 'status'],
    materialdescription: ['materialdescription', 'material description', 'description'],
    serialnumber: ['serialnumber', 'serial number', 'sno', 's-no'],
    devicedata: ['devicedata', 'device data'],
    salesoffice: ['salesoffice', 'sales office'],
    materialcode: ['materialcode', 'material code', 'code'],
    reportedproblem: ['reportedproblem', 'reported problem', 'problem'],
    dealercode: ['dealercode', 'dealer code'],
    customercode: ['customercode', 'customer code'],
    partnerresp: ['partnerresp', 'partnerresp.', 'partner response'],
    breakdown: ['breakdown', 'break down']
  };

  const map = {};
  headers.forEach(h => {
    const keyN = normalize(h);
    for (const [schemaField, synonyms] of Object.entries(dictionary)) {
      if (synonyms.some(v => normalize(v) === keyN)) {
        map[h] = schemaField;
        break;
      }
    }
  });
  return map;
}

/* ---------------------------------- Excel / CSV */
const parseExcel = buffer => {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
};

const parseCSV = buffer => new Promise((res, rej) => {
  const out = [];
  Readable.from(buffer)
    .pipe(csv())
    .on('data', d => out.push(d))
    .on('end', () => res(out))
    .on('error', rej);
});

/* ---------------------------------- validate one row */
function validateRow(rawRow, map) {
  const cleaned = {};
  for (const [original, schemaField] of Object.entries(map)) {
    const v = rawRow[original];
    if (v !== undefined && v !== null) cleaned[schemaField] = String(v).trim();
  }

  const errs = [];

  if (!cleaned.notification_complaintid)
    errs.push('Notification/Complaint ID is required');

  if (!cleaned.materialdescription)
    errs.push('Material Description is required');

  if (cleaned.notification_complaintid &&
    cleaned.notification_complaintid.length > 100)
    errs.push('Complaint ID too long (max 100 chars)');

  if (cleaned.materialdescription &&
    cleaned.materialdescription.length > 500)
    errs.push('Material Description too long (max 500 chars)');

  return { cleaned, errs };
}

// -----------------------------------------------------------------------
// 2. Route
// -----------------------------------------------------------------------
router.post(
  '/bulk-upload',
  upload.single('file'),
  async (req, res) => {
    const rsp = {
      status: 'processing',
      startTime: new Date(),
      totalRecords: 0,
      processedRecords: 0,
      successfulRecords: 0,
      failedRecords: 0,
      results: [],
      summary: {
        created: 0,
        updated: 0,
        failed: 0,
        duplicatesInFile: 0,
        existingRecords: 0,
        skippedTotal: 0
      },
      headerMapping: {},
      errors: []
    };

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // streaming headers
      res.set({
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });

      // ---- parse file
      let rows;
      try {
        const name = req.file.originalname.toLowerCase();
        rows = name.endsWith('.csv')
          ? await parseCSV(req.file.buffer)
          : parseExcel(req.file.buffer);
      } catch (e) {
        return res
          .status(400)
          .json({ error: 'File parsing error: ' + e.message });
      }

      if (!rows || !rows.length)
        return res.status(400).json({ error: 'Empty file' });

      rsp.totalRecords = rows.length;

      // ---- map & check headers
      const headers = Object.keys(rows[0] || {});
      const map = mapHeaders(headers);
      rsp.headerMapping = map;

      const required = ['notification_complaintid', 'materialdescription'];
      const missing = required.filter(r => !Object.values(map).includes(r));
      if (missing.length) {
        return res.status(400).json({
          error: `Missing required columns: ${missing.join(', ')}`
        });
      }

      res.write(JSON.stringify(rsp) + '\n');

      // -----------------------------------------------------------------
      // 3. Batch processing
      // -----------------------------------------------------------------
      const BATCH = 50;
      const seenIds = new Set();

      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);

        for (const [idx, raw] of batch.entries()) {
          const rowNum = i + idx + 2;          // +2 (header + 1-index)
          const result = {
            row: rowNum,
            id: '',
            status: 'Processing',
            action: '',
            error: null,
            warnings: []
          };

          try {
            const { cleaned, errs } = validateRow(raw, map);
            result.id = cleaned.notification_complaintid || 'Unknown';

            if (errs.length) {
              result.status = 'Failed';
              result.error = errs.join(', ');
              result.action = 'Validation failed';
              rsp.failedRecords++;
              rsp.summary.failed++;
              rsp.results.push(result);
              rsp.processedRecords++;
              continue;
            }

            // duplicate inside file?
            if (seenIds.has(cleaned.notification_complaintid)) {
              result.status = 'Skipped';
              result.action = 'Duplicate in file';
              result.error = 'Duplicate Notification/Complaint ID in file';
              rsp.summary.duplicatesInFile++;
              rsp.summary.skippedTotal++;
              rsp.results.push(result);
              rsp.processedRecords++;
              continue;
            }
            seenIds.add(cleaned.notification_complaintid);

            // ---- DB
            const existing = await PendingComplaints.findOne({
              notification_complaintid: cleaned.notification_complaintid
            });

            if (existing) {
              // Compare changes (here we update only fields that changed)
              let changed = false;
              for (const [k, v] of Object.entries(cleaned)) {
                if (existing[k] !== v) { existing[k] = v; changed = true; }
              }

              if (changed) {
                await existing.save();
                result.status = 'Updated';
                result.action = 'Record updated';
                rsp.summary.updated++;
                rsp.successfulRecords++;
              } else {
                result.status = 'Skipped';
                result.action = 'No changes';
                rsp.summary.existingRecords++;
                rsp.summary.skippedTotal++;
              }
            } else {
              await PendingComplaints.create(cleaned);
              result.status = 'Created';
              result.action = 'New record created';
              rsp.summary.created++;
              rsp.successfulRecords++;
            }

            rsp.results.push(result);

          } catch (err) {
            result.status = 'Failed';
            result.action = 'DB error';
            result.error = err.message;
            rsp.failedRecords++;
            rsp.summary.failed++;
            rsp.results.push(result);
          }

          rsp.processedRecords++;
        }

        // ---- stream progress
        res.write(
          JSON.stringify({
            ...rsp,
            progress: Math.round(
              (rsp.processedRecords / rsp.totalRecords) * 100
            )
          }) + '\n'
        );
        await new Promise(r => setTimeout(r, 10));   // throttle
      }

      // -----------------------------------------------------------------
      // 4. Done
      // -----------------------------------------------------------------
      rsp.status = 'completed';
      rsp.endTime = new Date();
      rsp.duration =
        ((rsp.endTime - rsp.startTime) / 1000).toFixed(2) + 's';
      rsp.progress = 100;

      rsp.message =
        `Completed.  Created: ${rsp.summary.created}, Updated: ` +
        `${rsp.summary.updated}, Failed: ${rsp.summary.failed}, ` +
        `File-duplicates: ${rsp.summary.duplicatesInFile}, ` +
        `Already-same: ${rsp.summary.existingRecords}`;

      res.write(JSON.stringify(rsp) + '\n');
      res.end();

    } catch (e) {
      console.error('Pending-Complaints bulk-upload error:', e);

      if (!res.headersSent) {
        res.status(500).json({ error: 'Server error: ' + e.message });
      } else {
        rsp.status = 'failed';
        rsp.error = e.message;
        res.write(JSON.stringify(rsp) + '\n');
        res.end();
      }
    }
  }
);

module.exports = router;
