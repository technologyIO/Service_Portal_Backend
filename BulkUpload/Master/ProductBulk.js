
const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const csv = require('csv-parser');
const { Readable } = require('stream');
const Product = require('../../Model/MasterSchema/ProductSchema');    

 
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase().slice(-4);
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || // .xlsx
      file.mimetype === 'application/vnd.ms-excel' ||                                          // .xls
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/csv' ||
      ext === '.csv' || ext === '.xlsx' || ext === '.xls'
    ) { cb(null, true); }
    else { cb(new Error('Only .xlsx, .xls or .csv files are accepted'), false); }
  },
  limits: { fileSize: 50 * 1024 * 1024 }     // 50 MB
});

/* -----------------------------------------------------------------
   2.  Utilities – regex, memoised normaliser, date converter
------------------------------------------------------------------*/
const NON_ALNUM_RGX = /[^a-z0-9]/g;
const MULTISPACE_RGX = /\s+/g;
const FIELD_CACHE = new Map();

function norm(field = '') {
  if (FIELD_CACHE.has(field)) return FIELD_CACHE.get(field);
  const n = field.toLowerCase().replace(NON_ALNUM_RGX, '').trim();
  FIELD_CACHE.set(field, n);
  return n;
}

function excelSerialToDate(val) {
  // Accepts excel serial, ISO string or JS Date
  if (!val) return undefined;
  if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000);
  const d = new Date(val);
  return isNaN(d) ? undefined : d;
}

/* -----------------------------------------------------------------
   3.  Column-name mappings coming from front-end
------------------------------------------------------------------*/
const MAP = {
  partnoid: new Set(['partno', 'partnoid', 'partnumber', 'part_number', 'part no', 'part noid']),
  product: new Set(['productdescription', 'product desc', 'product', 'productdescription1']),
  productgroup: new Set(['productgroup', 'group', 'product group']),
  subgrp: new Set(['subgrp', 'subgroup', 'sub_grp', 'sub group']),
  frequency: new Set(['frequency', 'freq']),
  dateoflaunch: new Set(['dateoflaunch', 'launchdate', 'date of launch']),
  endofsaledate: new Set(['endofsaledate', 'eos', 'end of sale']),
  endofsupportdate: new Set(['endofsupportdate', 'eosd', 'end of support']),
  exsupportavlb: new Set(['exsupportavlb', 'ex support avlb', 'exsupportavailable']),
  installationcheckliststatusboolean: new Set(['installation checklist status', 'installationcheckliststatus', 'installation checklist statusboolean']),
  pmcheckliststatusboolean: new Set(['pm checklist status', 'pmcheckliststatus', 'pmcheckliststatusboolean'])
};

/* -----------------------------------------------------------------
   4.  Header mapping
------------------------------------------------------------------*/
function mapHeaders(headers) {
  const mapped = {};
  const seen = new Set();
  for (const h of headers) {
    const n = norm(h);
    if (seen.has(n)) continue;
    seen.add(n);

    for (const [schemaField, variations] of Object.entries(MAP)) {
      if (variations.has(n)) {
        mapped[h] = schemaField;
        break;
      }
    }
  }
  return mapped;
}

/* -----------------------------------------------------------------
   5.  File parsers – XLSX and CSV
------------------------------------------------------------------*/
function parseExcel(buf) {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
}

function parseCSV(buf) {
  return new Promise((res, rej) => {
    const rows = [];
    const s = Readable.from(buf.toString())
      .pipe(csv({ mapValues: ({ value }) => value.trim(), skipEmptyLines: true }))
      .on('data', d => rows.push(d))
      .on('end', () => res(rows))
      .on('error', rej);
    s.on('error', () => s.destroy());
  });
}

/* -----------------------------------------------------------------
   6.  Record validation / cleaning
------------------------------------------------------------------*/
function validate(rec, headerMap) {
  const clean = {};
  const provided = [];
  const errs = [];

  // header map
  for (const [orig, schemaField] of Object.entries(headerMap)) {
    if (rec[orig] === undefined || rec[orig] === null) continue;
    const val = String(rec[orig]).replace(MULTISPACE_RGX, ' ').trim();
    if (val === '' || val.toLowerCase() === 'null' || val.toLowerCase() === 'undefined') continue;

    clean[schemaField] = val;
    provided.push(schemaField);
  }

  // mandatory
  if (!clean.partnoid) errs.push('Part No is required');
  if (!clean.product) errs.push('Product Description is required');

  // date parse
  ['dateoflaunch', 'endofsaledate', 'endofsupportdate', 'exsupportavlb'].forEach(f => {
    if (clean[f]) clean[f] = excelSerialToDate(clean[f]);
  });

  // booleans -> "true"/"false"
  ['installationcheckliststatusboolean', 'pmcheckliststatusboolean'].forEach(f => {
    if (clean[f] !== undefined) {
      const v = String(clean[f]).toLowerCase();
      clean[f] = (v === 'true' || v === 'yes' || v === '1') ? 'true'
        : (v === 'false' || v === 'no' || v === '0') ? 'false'
          : undefined;
    }
  });

  return { clean, errs, provided };
}

/* -----------------------------------------------------------------
   7.  Change detector
------------------------------------------------------------------*/
function diff(oldRec, newRec, fields) {
  let changed = false;
  const details = [];
  for (const f of fields) {
    const a = oldRec[f] ? String(oldRec[f]) : '';
    const b = newRec[f] ? String(newRec[f]) : '';
    if (a !== b) {
      changed = true;
      details.push({ field: f, oldValue: a, newValue: b });
    }
  }
  return { changed, details };
}

/* -----------------------------------------------------------------
   8.  MAIN ROUTE – POST /bulk-upload
------------------------------------------------------------------*/
router.post('/bulk-upload', upload.single('file'), async (req, res) => {

  const BATCH = 2000;
  const PARALLEL = 3;

  /* ------- INITIAL response skeleton ---------- */
  const out = {
    status: 'processing',
    startTime: new Date(),
    totalRecords: 0,
    processedRecords: 0,
    successfulRecords: 0,
    failedRecords: 0,
    headerMapping: {},
    summary: {
      created: 0,
      updated: 0,
      failed: 0,
      skippedTotal: 0,
      duplicatesInFile: 0,
      noChangesSkipped: 0,
      existingRecords: 0
    },
    results: []
  };

  try {
    /* ------------------- No file? -------------------- */
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    /* ------------- Parse excel / csv --------------- */
    const ext = req.file.originalname.toLowerCase().slice(-4);
    let rows;
    try {
      rows = (ext === '.csv')
        ? await parseCSV(req.file.buffer)
        : parseExcel(req.file.buffer);
    } catch (e) {
      return res.status(400).json({ error: `Unable to parse file – ${e.message}` });
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'Empty file / No data found' });
    }

    out.totalRecords = rows.length;

    /* ------------- Header mapping / validation --------------- */
    const headers = Object.keys(rows[0]);
    const headerMap = mapHeaders(headers);
    out.headerMapping = headerMap;

    if (!Object.values(headerMap).includes('partnoid')) {
      return res.status(400).json({ error: `Required column "Part No" not found. Headers present: ${headers.join(', ')}` });
    }

    /* ---- STREAM SETTINGS so that client gets live JSON ----- */
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.write(JSON.stringify(out) + '\n');

    /* ------------- Duplicate tracking inside file ------------- */
    const seenPartNo = new Set();

    /* -----------------------------------------------------------
       Batch processor
    ----------------------------------------------------------- */
    const processBatch = async (batch) => {
      const batchRes = [];
      const toWrite = [];
      const now = new Date();

      let created = 0, updated = 0, failed = 0, skipped = 0;

      /* ---- 1. clean / validate each row ---- */
      for (const raw of batch) {
        const rowRes = {
          partnoid: '',
          status: 'Processing',
          action: '',
          error: null,
          warnings: []
        };

        try {
          const { clean, errs, provided } = validate(raw, headerMap);
          rowRes.partnoid = clean.partnoid || 'Unknown';

          if (errs.length) {
            rowRes.status = 'Failed';
            rowRes.error = errs.join(', ');
            rowRes.action = 'Validation failed';
            batchRes.push(rowRes);
            failed++;
            continue;
          }

          if (seenPartNo.has(clean.partnoid)) {
            rowRes.status = 'Skipped';
            rowRes.action = 'Duplicate in file';
            rowRes.error = 'Duplicate part number in same file';
            skipped++;
            out.summary.duplicatesInFile++;
            batchRes.push(rowRes);
            continue;
          }
          seenPartNo.add(clean.partnoid);

          toWrite.push({ clean, provided, rowRes });
        } catch (e) {
          rowRes.status = 'Failed';
          rowRes.action = 'System error during validate';
          rowRes.error = e.message;
          failed++;
          batchRes.push(rowRes);
        }
      }

      /* ---- 2. DB read – find existing ---- */
      if (toWrite.length) {
        const ids = toWrite.map(r => r.clean.partnoid);
        const existing = await Product.find({ partnoid: { $in: ids } }).lean();
        const existMap = new Map(existing.map(e => [e.partnoid, e]));

        /* ---- 3. prepare bulk ops ---- */
        const ops = [];
        for (const item of toWrite) {
          const { clean, provided, rowRes } = item;
          const old = existMap.get(clean.partnoid);

          if (old) {
            out.summary.existingRecords++;
            const { changed, details } = diff(old, clean, provided);
            if (changed) {
              const upd = { modifiedAt: now };
              provided.forEach(f => upd[f] = clean[f]);

              ops.push({
                updateOne: {
                  filter: { partnoid: clean.partnoid },
                  update: { $set: upd }
                }
              });

              rowRes.status = 'Updated';
              rowRes.action = 'Updated existing';
              rowRes.changeDetails = details;
              updated++;
            } else {
              rowRes.status = 'Skipped';
              rowRes.action = 'No changes detected';
              out.summary.noChangesSkipped++;
              skipped++;
            }
          } else {
            ops.push({
              insertOne: {
                document: { ...clean, createdAt: now, modifiedAt: now }
              }
            });
            rowRes.status = 'Created';
            rowRes.action = 'Inserted new';
            created++;
          }
          batchRes.push(rowRes);
        }

        /* ---- 4. Bulk write ---- */
        if (ops.length) {
          try {
            await Product.bulkWrite(ops, { ordered: false });
          } catch (e) {
            // mark failed ones
            if (e.writeErrors) {
              e.writeErrors.forEach(err => {
                const pn =
                  err.op?.partnoid ||
                  err.op?.updateOne?.filter?.partnoid;
                const r = batchRes.find(x => x.partnoid === pn);
                if (r) {
                  if (r.status === 'Created') created--;
                  if (r.status === 'Updated') updated--;
                  r.status = 'Failed';
                  r.action = 'Bulk op failed';
                  r.error = err.errmsg;
                  failed++;
                }
              });
            }
          }
        }
      }

      return { batchRes, created, updated, failed, skipped };
    }; // processBatch

    /* -----------------------------------------------------------
       9.  Batch loop with limited parallelism
    ----------------------------------------------------------- */
    const totalBatches = Math.ceil(rows.length / BATCH);
    const inflight = [];
    let index = 0;

    for (let b = 0; b < totalBatches; b++) {
      const slice = rows.slice(b * BATCH, Math.min((b + 1) * BATCH, rows.length));
      const prom = processBatch(slice);
      inflight.push(prom);

      if (inflight.length === PARALLEL) {
        const done = await Promise.race(inflight);
        inflight.splice(inflight.indexOf(done), 1);
        handleBatch(done);
      }
    }
    while (inflight.length) {
      handleBatch(await inflight.shift());
    }

    /* ------------ finalise ------------- */
    out.status = 'completed';
    out.endTime = new Date();
    out.duration = ((out.endTime - out.startTime) / 1000).toFixed(2) + 's';
    res.write(JSON.stringify(out) + '\n');
    res.end();

  } catch (err) {
    console.error('Product bulk upload error:', err);
    if (!res.headersSent) return res.status(500).json({ error: err.message });
    res.write(JSON.stringify({ status: 'failed', error: err.message }) + '\n');
    res.end();
  }

  /* helper to merge finished batch into output & stream */
  function handleBatch({ batchRes, created, updated, failed, skipped }) {
    out.processedRecords += batchRes.length;
    out.successfulRecords += created + updated;
    out.failedRecords += failed;
    out.summary.created += created;
    out.summary.updated += updated;
    out.summary.failed += failed;
    out.summary.skippedTotal += skipped;
    out.results.push(...batchRes);

    // send incremental update (last 3 records for lighter payload)
    res.write(JSON.stringify({
      progress: `${out.processedRecords}/${out.totalRecords}`,
      summary: out.summary,
      latest: batchRes.slice(-3)
    }) + '\n');
  }
});

/* ----------------------------------------------------------------- */
module.exports = router;
