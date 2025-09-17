// routes/onCallCNote.js
const mongoose = require('mongoose');
const express = require('express');
const OnCallCNote = require('../../Model/AppSchema/OnCallCNoteSchema');
const OnCall = require('../../Model/AppSchema/onCallSchema');
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const User = require('../../Model/MasterSchema/UserSchema');

const router = express.Router();



const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'webadmin@skanray-access.com',
        pass: 'rdzegwmzirvbjcpm'
    }
});


// Function to generate HTML template from OnCall CNote data
const generateOnCallHtmlTemplate = (cnoteData) => {
    const sparesHtml = cnoteData.spares.map((spare, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${spare.Description}</td>
            <td>${spare.PartNumber}</td>
            <td>OnCall Service</td>
            <td>1</td>
            <td>${spare.Rate?.toLocaleString('en-IN') || 0}</td>
            <td>${spare.Rate?.toLocaleString('en-IN') || 0}</td>
        </tr>
    `).join('');

    const totalInWords = numberToWords(cnoteData.finalAmount);

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SKANRAY TECHNOLOGIES LIMITED - ONCALL CONTRACT NOTE</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                color: #333;
            }
            .header {
                text-align: center;
                margin-bottom: 20px;
            }
            .header h1 {
                font-size: 18px;
                margin: 0;
                font-weight: bold;
            }
            .header h2 {
                font-size: 16px;
                margin: 5px 0 0 0;
                font-weight: bold;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 15px;
            }
            table, th, td {
                border: 1px solid #000;
            }
            th, td {
                padding: 8px;
                text-align: left;
                vertical-align: top;
            }
            .section-title {
                font-weight: bold;
                margin: 15px 0 5px 0;
            }
            .total-row {
                font-weight: bold;
            }
            .footer {
                font-size: 12px;
                margin-top: 30px;
                text-align: center;
            }
            .signature-table {
                margin-top: 30px;
            }
            .note {
                font-size: 12px;
                margin-top: 15px;
            }
            .page-break {
                page-break-after: always;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>SKANRAY TECHNOLOGIES LIMITED</h1>
            <h2>ONCALL SERVICE CONTRACT NOTE</h2>
        </div>

        <div class="section-title">For Office Use Only</div>
        <table>
            <tr>
                <td>OnCall CNote Number / Date</td>
                <td>${cnoteData.cnoteNumber} / ${new Date(cnoteData.createdAt).toLocaleDateString('en-GB')}</td>
                <td>Region / Branch</td>
                <td>South Karnataka / MYS</td>
            </tr>
            <tr>
                <td>Engineer PS No</td>
                <td>IT276</td>
                <td>Engineer Name</td>
                <td>Sony Ponnanna_Sales</td>
            </tr>
            <tr>
                <td>Dealer Code</td>
                <td>${cnoteData.complaint?.dealercode || ''}</td>
                <td>Dealer Name</td>
                <td></td>
            </tr>
            <tr>
                <td>OnCall Number</td>
                <td>${cnoteData.onCallNumber}</td>
                <td>Complaint ID</td>
                <td>${cnoteData.complaint?.notification_complaintid || ''}</td>
            </tr>
            <tr>
                <td>Service Date</td>
                <td>${new Date(cnoteData.createdAt).toLocaleDateString('en-GB')}</td>
                <td>Device Serial</td>
                <td>${cnoteData.complaint?.serialnumber || ''}</td>
            </tr>
        </table>

        <div class="section-title">Customer (Sold to Party)</div>
        <table>
            <tr>
                <th width="50%">Customer Name</th>
                <th width="50%">Service Location</th>
            </tr>
            <tr>
                <td>${cnoteData.customer.customername}</td>
                <td>${cnoteData.customer.customername}</td>
            </tr>
            <tr>
                <td>${cnoteData.customer.city}, ${cnoteData.customer.postalcode}</td>
                <td>${cnoteData.customer.city}, ${cnoteData.customer.postalcode}</td>
            </tr>
            <tr>
                <td>${cnoteData.customer.city} / Karnataka</td>
                <td>${cnoteData.customer.city} / Karnataka</td>
            </tr>
            <tr>
                <td>${cnoteData.customer.email}</td>
                <td>${cnoteData.customer.email}</td>
            </tr>
            <tr>
                <td>${cnoteData.customer.telephone}</td>
                <td>${cnoteData.customer.telephone}</td>
            </tr>
            <tr>
                <td>PAN / GST: ${cnoteData.customer.taxnumber1} / ${cnoteData.customer.taxnumber2}</td>
                <td>Customer Code: ${cnoteData.customer.customercodeid}</td>
            </tr>
        </table>

        <div class="section-title">DEVICE & COMPLAINT DETAILS</div>
        <table>
            <tr>
                <td>Device</td>
                <td>${cnoteData.complaint?.materialdescription || ''}</td>
                <td>Material Code</td>
                <td>${cnoteData.complaint?.materialcode || ''}</td>
            </tr>
            <tr>
                <td>Serial Number</td>
                <td>${cnoteData.complaint?.serialnumber || ''}</td>
                <td>Sales Office</td>
                <td>${cnoteData.complaint?.salesoffice || ''}</td>
            </tr>
            <tr>
                <td>Reported Problem</td>
                <td colspan="3">${cnoteData.complaint?.reportedproblem || ''}</td>
            </tr>
            <tr>
                <td>Device Data</td>
                <td colspan="3">${cnoteData.complaint?.devicedata || ''}</td>
            </tr>
        </table>

        <div class="section-title">SPARE PARTS DETAILS</div>
        <table>
            <thead>
                <tr>
                    <th>S.No.</th>
                    <th>Spare Description</th>
                    <th>Part No</th>
                    <th>Service Type</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total Price</th>
                </tr>
            </thead>
            <tbody>
                ${sparesHtml}
                ${cnoteData.additionalServiceCharge ? `
                <tr>
                    <td>${cnoteData.spares.length + 1}</td>
                    <td>Additional Service Charge (${cnoteData.additionalServiceCharge.location})</td>
                    <td>SERVICE</td>
                    <td>OnCall Service</td>
                    <td>1</td>
                    <td>${cnoteData.additionalServiceCharge.enteredCharge?.toLocaleString('en-IN')}</td>
                    <td>${cnoteData.additionalServiceCharge.enteredCharge?.toLocaleString('en-IN')}</td>
                </tr>
                ` : ''}
                <tr class="total-row">
                    <td colspan="6">Total Rs: ${totalInWords}</td>
                    <td>${cnoteData.finalAmount?.toLocaleString('en-IN')}</td>
                </tr>
            </tbody>
        </table>

        <div class="section-title">Payment Terms</div>
        <table>
            <tr>
                <td>Advance</td>
                <td>100%</td>
                <td>Balance Payment (days)</td>
                <td>0 days</td>
            </tr>
            <tr>
                <td>Service Period</td>
                <td>Immediate</td>
                <td>Warranty</td>
                <td>As per standard terms</td>
            </tr>
            <tr>
                <td>Other Conditions (If any)</td>
                <td colspan="3">${cnoteData.remark || ''}</td>
            </tr>
        </table>

        <div class="page-break"></div>

        <p>The undersigned hereby orders the afore-mentioned OnCall service from Skanray Technologies Limited (Healthcare Division). The service specified above to be delivered as per the condition of sales and terms of business set out in this contract.</p>

        <table class="signature-table">
            <tr>
                <th width="33%">Customer Signature and seal</th>
                <th width="34%">Accepted on behalf of Skanray Technologies Limited</th>
                <th width="33%">Service Engineer Approval</th>
            </tr>
            <tr>
                <td>Date:</td>
                <td>Digitally Accepted by SE: Sony Ponnanna_Sales :<br>Date: ${new Date().toLocaleDateString('en-GB')}</td>
                <td>Date:</td>
            </tr>
        </table>

        <div class="note">
            <p><strong>Form No : OC3F5007 Rev# 1.0</strong></p>
            <p>Note: This is an OnCall service contract note. Effective from 1st Oct 2020, as per Govt Of India Notification TCS (Tax collection at Source) will be charged if applicable at the rate of 0.1% if PAN / Aadhaar is submitted other wise 1%</p>
            <p>Page 2 of 2</p>
        </div>

        <div class="footer">
            <p>Skanray Technologies Limited, Regd. Office: Plot #15-17, Hebbal Industrial Area, Mysuru - 570016, INDIA. P +91 8212415559 CIN U72206KA2007PLC041774 Healthcare Division: #360, KIADB Industrial Area, Hebbal, Mysuru - 570018, INDIA. P +91 8212407000 E office@skanray.com W www.skanray.com</p>
        </div>
    </body>
    </html>
    `;
};

// Helper function to convert numbers to words (same as before)
function numberToWords(num) {
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', 'Ten', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (num === 0) return 'Zero';

    let words = '';
    if (num >= 10000000) {
        words += numberToWords(Math.floor(num / 10000000)) + ' Crore ';
        num %= 10000000;
    }
    if (num >= 100000) {
        words += numberToWords(Math.floor(num / 100000)) + ' Lakh ';
        num %= 100000;
    }
    if (num >= 1000) {
        words += numberToWords(Math.floor(num / 1000)) + ' Thousand ';
        num %= 1000;
    }
    if (num >= 100) {
        words += numberToWords(Math.floor(num / 100)) + ' Hundred ';
        num %= 100;
    }
    if (num > 0) {
        if (words !== '') words += 'and ';
        if (num < 10) words += units[num];
        else if (num < 20) words += teens[num - 10];
        else {
            words += tens[Math.floor(num / 10)];
            if (num % 10 !== 0) words += ' ' + units[num % 10];
        }
    }
    return words.trim() + ' Only';
}

// Function to generate PDF using Puppeteer and send email
const generateAndSendPdf = async (cnoteData, res) => {
    let browser;
    let page;
    const maxRetries = 3;
    let retryCount = 0;
    let pdfBuffer = null;

    try {
        const htmlContent = generateOnCallHtmlTemplate(cnoteData);

        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });

        while (retryCount < maxRetries && !pdfBuffer) {
            try {
                page = await browser.newPage();
                await page.setContent(htmlContent, {
                    waitUntil: ['load', 'domcontentloaded', 'networkidle0']
                });

                await page.waitForSelector('.total-row', { timeout: 5000 });

                pdfBuffer = await page.pdf({
                    format: 'A4',
                    printBackground: true,
                    margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
                });

            } catch (attemptError) {
                retryCount++;
                console.error(`PDF attempt ${retryCount} failed:`, attemptError);

                if (page && !page.isClosed()) await page.close();

                if (retryCount === maxRetries) {
                    throw new Error(`PDF generation failed after ${maxRetries} attempts`);
                }
            }
        }

        if (!pdfBuffer) {
            throw new Error('PDF generation failed');
        }

        const mailOptions = {
            from: 'webadmin@skanray-access.com',
            to: 'ftshivamtiwari222@gmail.com',
            subject: `OnCall CNote Generated - ${cnoteData.cnoteNumber}`,
            text: `OnCall CNote ${cnoteData.cnoteNumber} for ${cnoteData.customer.customername}`,
            attachments: [
                {
                    filename: `OnCallCNote_${cnoteData.cnoteNumber}_${Date.now()}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        await transporter.sendMail(mailOptions);

        res.status(201).json({
            message: 'OnCall CNote created and email sent',
            cnote: cnoteData
        });

    } catch (error) {
        console.error('Final PDF generation failure:', error);

        res.status(500).json({
            message: 'OnCall CNote creation aborted - PDF generation failed',
            error: error.message
        });
    } finally {
        if (page && !page.isClosed()) await page.close();
        if (browser) await browser.close();
    }
};

// API endpoint to create OnCall CNote and send PDF
router.post('/', async (req, res) => {
    try {
        const { onCallId } = req.body;

        if (!mongoose.Types.ObjectId.isValid(onCallId)) {
            return res.status(400).json({ message: 'Invalid OnCall ID format' });
        }

        const onCall = await OnCall.findById(onCallId);
        if (!onCall) {
            return res.status(404).json({ message: 'OnCall not found' });
        }

        if (!onCall.onCallNumber) {
            return res.status(400).json({ message: 'OnCall number is missing' });
        }

        const existingCNote = await OnCallCNote.findOne({ onCallNumber: onCall.onCallNumber });
        if (existingCNote) {
            return res.status(400).json({ message: 'OnCall CNote already exists for this OnCall' });
        }

        // Generate cnoteNumber
        const lastCNote = await OnCallCNote.findOne().sort({ cnoteNumber: -1 });
        let newNumber = 1;
        if (lastCNote && lastCNote.cnoteNumber) {
            const lastNumber = parseInt(lastCNote.cnoteNumber.replace('OCN-', '').split('-')[1], 10);
            newNumber = lastNumber + 1;
        }
        const year = new Date().getFullYear();
        const cnoteNumber = `OCN-${year}-${newNumber.toString().padStart(5, '0')}`;

        const checkDuplicate = await OnCallCNote.findOne({ cnoteNumber });
        if (checkDuplicate) {
            return res.status(400).json({ message: 'Generated OnCall CNote number already exists. Try again.' });
        }

        // Flatten spares
        const flattenedSpares = [];
        onCall.productGroups?.forEach(group => {
            group.spares?.forEach(spare => {
                flattenedSpares.push({
                    ...spare,
                    productPartNo: group.productPartNo,
                    subgroup: group.subgroup
                });
            });
        });

        const cnoteData = {
            cnoteNumber,
            onCallNumber: onCall.onCallNumber,
            customer: onCall.customer,
            complaint: onCall.complaint,
            spares: flattenedSpares,
            additionalServiceCharge: onCall.additionalServiceCharge,
            RSHApproval: onCall.RSHApproval,
            NSHApproval: onCall.NSHApproval,
            tdsPercentage: onCall.tdsPercentage,
            discountPercentage: onCall.discountPercentage,
            gstPercentage: onCall.gstPercentage,
            remark: onCall.remark,
            grandSubTotal: onCall.grandSubTotal,
            discountAmount: onCall.discountAmount,
            afterDiscount: onCall.afterDiscount,
            tdsAmount: onCall.tdsAmount,
            afterTds: onCall.afterTds,
            gstAmount: onCall.gstAmount,
            finalAmount: onCall.finalAmount,
            revisions: onCall.revisions,
            currentRevision: onCall.currentRevision,
            status: 'draft',
            createdBy: onCall.createdBy,
            issuedBy: req.user?.id || null
        };

        const cnote = new OnCallCNote(cnoteData);
        await cnote.save();

        // **** Update OnCall schema with cnoteNumber ****
        await OnCall.findByIdAndUpdate(onCallId, { cnoteNumber }, { new: true });

        // Generate PDF and send email
        await generateAndSendPdf(cnote, res);

    } catch (error) {
        console.error('OnCall CNote creation error:', error);
        res.status(500).json({ message: error.message });
    }
});

router.get('/search', async (req, res) => {
    try {
        // Extract query parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const searchTerm = req.query.q || req.query.search || '';

        // Base query
        let baseQuery = {};

        // Build search query if search term is provided
        if (searchTerm.trim()) {
            const searchRegex = new RegExp(searchTerm.trim(), 'i'); // case insensitive

            baseQuery.$or = [
                { cnoteNumber: searchRegex },
                { onCallNumber: searchRegex },
                { 'customer.customername': searchRegex },
                { 'customer.customercode': searchRegex },
                { 'customer.city': searchRegex },
                { 'customer.email': searchRegex },
                { 'complaint.notification_complaintid': searchRegex },
                { 'complaint.materialdescription': searchRegex },
                { 'complaint.serialnumber': searchRegex },
                { 'complaint.reportedproblem': searchRegex },
                { status: searchRegex },
                { remark: searchRegex },
                { 'spares.Description': searchRegex },
                { 'spares.PartNumber': searchRegex }
            ];
        }

        // Add additional filters if needed
        if (req.query.status) {
            baseQuery.status = req.query.status;
        }

        if (req.query.issuedBy) {
            baseQuery.issuedBy = req.query.issuedBy;
        }

        // Date range filter
        if (req.query.startDate || req.query.endDate) {
            baseQuery.createdAt = {};
            if (req.query.startDate) {
                baseQuery.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                baseQuery.createdAt.$lte = new Date(req.query.endDate);
            }
        }

        // Amount range filter
        if (req.query.minAmount) {
            baseQuery.finalAmount = {
                $gte: parseFloat(req.query.minAmount)
            };
        }

        if (req.query.maxAmount) {
            baseQuery.finalAmount = {
                ...baseQuery.finalAmount,
                $lte: parseFloat(req.query.maxAmount)
            };
        }

        // Execute search with pagination
        const cnotes = await OnCallCNote.find(baseQuery)
            .populate('issuedBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(); // Use lean() for better performance

        // Get total count for pagination
        const total = await OnCallCNote.countDocuments(baseQuery);
        const totalPages = Math.ceil(total / limit);

        // Calculate pagination info
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        // Prepare response
        const response = {
            success: true,
            data: cnotes,
            pagination: {
                currentPage: page,
                totalPages,
                totalRecords: total,
                recordsPerPage: limit,
                recordsOnPage: cnotes.length,
                hasNext,
                hasPrev,
                nextPage: hasNext ? page + 1 : null,
                prevPage: hasPrev ? page - 1 : null
            },
            search: {
                query: searchTerm,
                totalMatches: total,
                filters: {
                    status: req.query.status || null,
                    minAmount: req.query.minAmount || null,
                    maxAmount: req.query.maxAmount || null,
                    startDate: req.query.startDate || null,
                    endDate: req.query.endDate || null,
                    issuedBy: req.query.issuedBy || null
                }
            }
        };

        res.json(response);

    } catch (error) {
        console.error('OnCall CNote search error:', error);
        res.status(500).json({
            success: false,
            message: 'Error occurred during search',
            error: error.message
        });
    }
});
router.get('/paginated', async (req, res) => {
    try {
        // Default pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10; // Default 10 per page

        // Calculate skip
        const skip = (page - 1) * limit;

        // Get total count
        const total = await OnCallCNote.countDocuments({});
        const totalPages = Math.ceil(total / limit);

        // Fetch paginated data
        const cnotes = await OnCallCNote.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('issuedBy', 'name email')
            .lean();

        // Always return paginated response
        res.json({
            success: true,
            data: cnotes,
            pagination: {
                currentPage: page,
                totalPages,
                totalRecords: total,
                recordsPerPage: limit,
                recordsOnPage: cnotes.length,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                nextPage: page < totalPages ? page + 1 : null,
                prevPage: page > 1 ? page - 1 : null
            }
        });
    } catch (error) {
        console.error('OnCall CNote fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Error occurred while fetching CNotes',
            error: error.message
        });
    }
});

// Get all OnCall CNotes
router.get('/', async (req, res) => {
    try {
        const cnotes = await OnCallCNote.find()
            .sort({ createdAt: -1 })
            .populate('issuedBy', 'name email');

        res.json(cnotes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single OnCall CNote
router.get('/:cnoteNumber', async (req, res) => {
    try {
        const cnote = await OnCallCNote.findOne({ cnoteNumber: req.params.cnoteNumber })
            .populate('issuedBy', 'name email');

        if (!cnote) {
            return res.status(404).json({ message: 'OnCall CNote not found' });
        }

        res.json(cnote);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update OnCall CNote
router.put('/:cnoteNumber', async (req, res) => {
    try {
        const { cnoteNumber } = req.params;
        const updateData = req.body;

        const cnote = await OnCallCNote.findOneAndUpdate(
            { cnoteNumber },
            { ...updateData, updatedAt: Date.now() },
            { new: true }
        );

        if (!cnote) {
            return res.status(404).json({ message: 'OnCall CNote not found' });
        }

        res.json(cnote);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Issue OnCall CNote
router.post('/:cnoteNumber/issue', async (req, res) => {
    try {
        const { cnoteNumber } = req.params;

        const cnote = await OnCallCNote.findOneAndUpdate(
            { cnoteNumber },
            {
                status: 'issued',
                issuedAt: Date.now(),
                issuedBy: req.user.id,
                updatedAt: Date.now()
            },
            { new: true }
        );

        if (!cnote) {
            return res.status(404).json({ message: 'OnCall CNote not found' });
        }

        res.json(cnote);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Cancel OnCall CNote
router.post('/:cnoteNumber/cancel', async (req, res) => {
    try {
        const { cnoteNumber } = req.params;
        const { reason } = req.body;

        const cnote = await OnCallCNote.findOneAndUpdate(
            { cnoteNumber },
            {
                status: 'cancelled',
                cancellationReason: reason,
                updatedAt: Date.now()
            },
            { new: true }
        );

        if (!cnote) {
            return res.status(404).json({ message: 'OnCall CNote not found' });
        }

        res.json(cnote);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


router.delete('/:cnoteNumber', async (req, res) => {
    try {
        const { cnoteNumber } = req.params;

        // Find and delete the OnCall CNote by cnoteNumber
        const cnote = await OnCallCNote.findOneAndDelete({ cnoteNumber });

        if (!cnote) {
            return res.status(404).json({ message: 'OnCall CNote not found' });
        }

        // Remove the cnoteNumber from the related OnCall document
        await OnCall.findOneAndUpdate(
            { cnoteNumber },
            { $unset: { cnoteNumber: '' } } // unset the cnoteNumber field
        );

        res.json({ message: 'OnCall CNote deleted successfully and OnCall updated' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


module.exports = router;
