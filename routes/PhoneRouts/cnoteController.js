const mongoose = require('mongoose');
const express = require('express');
const CNote = require('../../Model/AppSchema/CNote');
const Proposal = require('../../Model/AppSchema/proposalSchema');
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const User = require('../../Model/MasterSchema/UserSchema');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads/cnotes');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Email transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'webadmin@skanray-access.com',
        pass: 'rdzegwmzirvbjcpm'
    }
});

// Function to generate HTML template from CNote data
const generateHtmlTemplate = (cnoteData, userInfo, dealerInfo) => {
    // Fix for undefined product description
    console.log('Template received userInfo:', userInfo);
    console.log('Template received dealerInfo:', dealerInfo);
    const itemsHtml = cnoteData.items.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${item.equipment?.materialdescription || 'N/A'}</td>
            <td>${item.equipment?.materialcode || 'N/A'}</td>
            <td>${item.years * 12}</td>
            <td>1</td>
            <td>${item.pricePerYear.toLocaleString('en-IN')}</td>
            <td>${item.subtotal.toLocaleString('en-IN')}</td>
        </tr>
    `).join('');

    const totalInWords = numberToWords(cnoteData.finalAmount);

    // Extract user name from userInfo
    const engineerName = userInfo ? `${userInfo.firstname} ${userInfo.lastname}` : 'N/A';

    const dealerName = dealerInfo?.dealerName || '';
    const dealerId = dealerInfo?.dealerId || '';
    console.log('Final dealer values - Name:', dealerName, 'ID:', dealerId); // Debug log


    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SKANRAY TECHNOLOGIES LIMITED - CONTRACT NOTE</title>
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
            <h2>CONTRACT NOTE</h2>
        </div>

        <div class="section-title">For Office Use Only</div>
        <table>
            <tr>
                <td>CRM-CNote Number / Date</td>
                <td>${cnoteData.cnoteNumber} / ${new Date(cnoteData.updatedAt).toLocaleDateString('en-GB')}</td>
                <td>Region / Branch</td>
                <td>South Karnataka / MYS</td>
            </tr>
            <tr>
                <td>Engineer PS No</td>
                <td>${userInfo?.employeeid || 'N/A'}</td>
                <td>Engineer Name</td>
                <td>${engineerName}</td>
            </tr>
            <tr>
                <td>Dealer Code</td>
                <td>${dealerId}</td>
                <td>Dealer Name</td>
                <td>${dealerName}</td>
            </tr>
            <tr>
                <td>Purchase Order No</td>
                <td>${cnoteData.proposalNumber}</td>
                <td>Quote No</td>
                <td>SK-Q0307 Rev-1</td>
            </tr>
            <tr>
                <td>Date of Purchase Order</td>
                <td>${new Date(cnoteData.createdAt).toLocaleDateString('en-GB')}</td>
                <td>Date of Quote</td>
                <td>${new Date(cnoteData.createdAt).toLocaleDateString('en-GB')}</td>
            </tr>
        </table>

        <div class="section-title">Customer (Sold to Party)</div>
        <table>
            <tr>
                <th width="50%">Customer Name</th>
                <th width="50%">Consignee (Ship to Party)</th>
            </tr>
            <tr>
                <td>${cnoteData.customer.customername}</td>
                <td></td>
            </tr>
            <tr>
                <td>${cnoteData.customer.city}, ${cnoteData.customer.postalcode}</td>
                <td></td>
            </tr>
            <tr>
                <td></td>
                <td></td>
            </tr>
            <tr>
                <td>${cnoteData.customer.city} / ${cnoteData.customer.postalcode}</td>
                <td></td>
            </tr>
            <tr>
                <td>${cnoteData.customer.city} / Karnataka</td>
                <td></td>
            </tr>
            <tr>
                <td>${cnoteData.customer.email}</td>
                <td></td>
            </tr>
            <tr>
                <td>${cnoteData.customer.telephone}</td>
                <td></td>
            </tr>
            <tr>
                <td>PAN / GST: ${cnoteData.customer.taxnumber1} / ${cnoteData.customer.taxnumber2}</td>
                <td></td>
            </tr>
        </table>

        <div class="section-title">ORDER DETAILS</div>
        <table>
            <thead>
                <tr>
                    <th>S.No.</th>
                    <th>Product Description</th>
                    <th>Part No</th>
                    <th>Warranty (Months)</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total Price</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
                <tr class="total-row">
                    <td colspan="6">Total Rs: ${totalInWords}</td>
                    <td>${cnoteData.finalAmount.toLocaleString('en-IN')}</td>
                </tr>
            </tbody>
        </table>

        <table>
            <thead>
                <tr>
                    <th>S.No.</th>
                    <th>Free Supply Items</th>
                    <th>Qty</th>
                </tr>
            </thead>
            <tbody>
                <!-- Empty rows for free supply items -->
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
                <td>Delivery Period</td>
                <td></td>
                <td>LD Applicable/Date</td>
                <td>No</td>
            </tr>
            <tr>
                <td>Other Conditions (If any)</td>
                <td colspan="3">${cnoteData.remark || ''}</td>
            </tr>
        </table>

        <div class="page-break"></div>

        <p>The undersigned hereby orders that afore-mentioned goods from Skanray Technologies Limited (Healthcare Division). The goods specified above to be delivered as per the condition of sales and terms of business set out in this contract. Seller's terms of business as printed overleaf are considered to form part of contract unless expressly overruled by any of the conditions stipulated therein.</p>

        <table class="signature-table">
            <tr>
                <th width="33%">Customer Signature and seal</th>
                <th width="34%">Accepted on behalf of Skanray Technologies Limited</th>
                <th width="33%">Regulatory Approval (If Applicable)</th>
            </tr>
            <tr>
                <td>Date:</td>
                <td>Digitally Accepted by SE: ${engineerName} :<br>Date: ${new Date().toLocaleDateString('en-GB')}</td>
                <td>Date:</td>
            </tr>
        </table>

        <div class="note">
            <p><strong>Form No : 3F5007 Rev# 6.0</strong></p>
            <p>Note: Effective from 1st Oct 2020, as per Govt Of India Notification TCS (Tax collection at Source) will be charged if applicable at the rate of 0.1% if PAN / Aadhaar is submitted other wise 1%</p>
            <p>Page 2 of 2</p>
        </div>

        <div class="footer">
            <p>Skanray Technologies Limited, Regd. Office: Plot #15-17, Hebbal Industrial Area, Mysuru - 570016, INDIA. P +91 8212415559 CIN U72206KA2007PLC041774 Healthcare Division: #360, KIADB Industrial Area, Hebbal, Mysuru - 570018, INDIA. P +91 8212407000 E office@skanray.com W www.skanray.com</p>
        </div>
    </body>
    </html>
    `;
};



// Helper function to convert numbers to words
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

// ✅ Fixed PDF Generation Function
const generatePdfFromHtml = async (htmlContent, cnoteNumber) => {
    let browser;
    try {
        // Launch puppeteer browser
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Set page content
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });

        // Save PDF to uploads folder
        const fileName = `CNote_${cnoteNumber}_${Date.now()}.pdf`;
        const filePath = path.join(uploadsDir, fileName);

        fs.writeFileSync(filePath, pdfBuffer);

        // Return both buffer and file info
        return {
            pdfBuffer,
            fileName,
            filePath,
            fileUrl: `/uploads/cnotes/${fileName}` // URL to access the file
        };

    } catch (error) {
        console.error('PDF generation error:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};

// ✅ Updated generateAndSendPdf function
// ✅ Updated generateAndSendPdf function
const generateAndSendPdf = async (cnote, userEmail, userInfo, dealerInfo) => {
    try {
        // Generate HTML content with user and dealer info
        const htmlContent = generateHtmlTemplate(cnote, userInfo, dealerInfo);

        // Generate PDF and save to uploads folder
        const pdfResult = await generatePdfFromHtml(htmlContent, cnote.cnoteNumber);

        // Send email with PDF attachment
        if (userEmail) {
            await sendEmailToUser(userEmail, cnote, pdfResult.pdfBuffer);
        }

        // Return the PDF file info to save URL in database
        return {
            pdfUrl: pdfResult.fileUrl,
            fileName: pdfResult.fileName
        };

    } catch (error) {
        console.error('PDF generation or email sending error:', error);
        throw error;
    }
};


// ✅ Function to send email to specific user only
const sendEmailToUser = async (userEmail, cnote, pdfBuffer) => {
    try {
        if (!userEmail) {
            throw new Error('User email is required');
        }

        const mailOptions = {
            from: 'webadmin@skanray-access.com',
            to: userEmail,
            subject: `CNote ${cnote.cnoteNumber} Generated Successfully`,
            html: `
                <h2>CNote Generated</h2>
                <p>Dear User,</p>
                <p>Your CNote <strong>${cnote.cnoteNumber}</strong> has been generated successfully.</p>
                <p>Please find the PDF attached.</p>
                <br>
                <p>Best regards,<br>Skanray Technologies Team</p>
            `,
            attachments: [
                {
                    filename: `CNote_${cnote.cnoteNumber}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to: ${userEmail}`, info.messageId);
        return info;

    } catch (error) {
        console.error('Email sending failed:', error);
        throw error;
    }
};
router.post('/', async (req, res) => {
    try {
        const { proposalId, user } = req.body;

        if (!mongoose.Types.ObjectId.isValid(proposalId)) {
            return res.status(400).json({ message: 'Invalid proposal ID format' });
        }

        const proposal = await Proposal.findById(proposalId);
        if (!proposal) {
            return res.status(404).json({ message: 'Proposal not found' });
        }

        if (!proposal.proposalNumber) {
            return res.status(400).json({ message: 'Proposal number is missing' });
        }

        const existingCNote = await CNote.findOne({ proposalNumber: proposal.proposalNumber });
        if (existingCNote) {
            return res.status(400).json({ message: 'CNote already exists for this proposal' });
        }

        // Generate cnoteNumber
        const lastCNote = await CNote.findOne().sort({ cnoteNumber: -1 });
        let newNumber = 1;
        if (lastCNote && lastCNote.cnoteNumber) {
            const lastNumber = parseInt(lastCNote.cnoteNumber.replace('CNOT', ''), 10);
            newNumber = lastNumber + 1;
        }
        const cnoteNumber = `CNOT${newNumber.toString().padStart(4, '0')}`;

        const checkDuplicate = await CNote.findOne({ cnoteNumber });
        if (checkDuplicate) {
            return res.status(400).json({ message: 'Generated CNote number already exists. Try again.' });
        }

        const cnoteData = proposal.toObject();
        delete cnoteData._id;
        delete cnoteData.__v;

        const cnote = new CNote({
            ...cnoteData,
            status: 'draft',
            createdBy: proposal.createdBy,
            issuedBy: req.user?.id || user?.id || null,
            cnoteNumber
        });

        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                // Save CNote
                await cnote.save({ session });

                // ✅ Update Proposal with cnoteNumber only (PDF info will be added later)
                await Proposal.findByIdAndUpdate(
                    proposalId,
                    { cnoteNumber: cnoteNumber },
                    { session }
                );
            });

            // Extract dealer info from user object correctly
            const userInfo = {
                firstname: user?.firstname || '',
                lastname: user?.lastname || '',
                employeeid: user?.employeeid || '',
                email: user?.email || ''
            };

            const dealerInfo = {
                dealerName: user?.dealerName || '',
                dealerId: user?.dealerId || '',
                dealerEmail: user?.dealerEmail || ''
            };

            console.log('User Info:', userInfo);
            console.log('Dealer Info:', dealerInfo);

            // Generate PDF and send email
            try {
                const pdfResult = await generateAndSendPdf(cnote, user?.email, userInfo, dealerInfo);

                // ✅ Update both CNote and Proposal with PDF URL and filename
                await Promise.all([
                    // Update CNote with PDF info
                    CNote.findByIdAndUpdate(
                        cnote._id,
                        {
                            pdfUrl: pdfResult.pdfUrl,
                            pdfFileName: pdfResult.fileName
                        }
                    ),
                    // ✅ Update Proposal with PDF info
                    Proposal.findByIdAndUpdate(
                        proposalId,
                        {
                            pdfUrl: pdfResult.pdfUrl,
                            pdfFileName: pdfResult.fileName
                        }
                    )
                ]);

                res.status(201).json({
                    success: true,
                    message: 'CNote created and email sent successfully',
                    data: {
                        ...cnote.toObject(),
                        pdfUrl: pdfResult.pdfUrl,
                        pdfFileName: pdfResult.fileName
                    }
                });

            } catch (emailError) {
                console.error('Email sending failed:', emailError);

                // Generate PDF anyway and save URL
                try {
                    const htmlContent = generateHtmlTemplate(cnote, userInfo, dealerInfo);
                    const pdfResult = await generatePdfFromHtml(htmlContent, cnote.cnoteNumber);

                    // ✅ Update both CNote and Proposal with PDF info even if email fails
                    await Promise.all([
                        // Update CNote with PDF info
                        CNote.findByIdAndUpdate(
                            cnote._id,
                            {
                                pdfUrl: pdfResult.pdfUrl,
                                pdfFileName: pdfResult.fileName
                            }
                        ),
                        // ✅ Update Proposal with PDF info
                        Proposal.findByIdAndUpdate(
                            proposalId,
                            {
                                pdfUrl: pdfResult.pdfUrl,
                                pdfFileName: pdfResult.fileName
                            }
                        )
                    ]);

                    res.status(201).json({
                        success: true,
                        message: 'CNote created successfully, but email failed to send',
                        error: emailError.message,
                        data: {
                            ...cnote.toObject(),
                            pdfUrl: pdfResult.pdfUrl,
                            pdfFileName: pdfResult.fileName
                        }
                    });
                } catch (pdfError) {
                    res.status(500).json({
                        message: 'CNote created but PDF generation and email failed',
                        error: pdfError.message
                    });
                }
            }

        } catch (transactionError) {
            await session.abortTransaction();
            throw transactionError;
        } finally {
            session.endSession();
        }

    } catch (error) {
        console.error('CNote creation error:', error);
        res.status(500).json({ message: error.message });
    }
});




// ✅ Add route to serve PDF files
router.get('/download/:fileName', (req, res) => {
    try {
        const fileName = req.params.fileName;
        const filePath = path.join(uploadsDir, fileName);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'PDF file not found' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('PDF download error:', error);
        res.status(500).json({ message: 'Error downloading PDF' });
    }
});

// REST OF YOUR EXISTING ROUTES (GET, PUT, DELETE, etc.)
// GET /paginated - Paginated list of CNotes
router.get('/paginated', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const total = await CNote.countDocuments({});
        const totalPages = Math.ceil(total / limit);

        const cnotes = await CNote.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('issuedBy', 'name email')
            .populate('items.RSHApproval.approvedBy', 'name')
            .populate('items.NSHApproval.approvedBy', 'name')
            .lean();

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
        console.error('CNote paginated fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Error occurred while fetching CNotes',
            error: error.message
        });
    }
});

// GET /search - Paginated search for CNotes
router.get('/search', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const searchTerm = req.query.q || req.query.search || '';

        let baseQuery = {};

        if (searchTerm.trim()) {
            const searchRegex = new RegExp(searchTerm.trim(), 'i');

            baseQuery.$or = [
                { cnoteNumber: searchRegex },
                { proposalNumber: searchRegex },
                { 'customer.customername': searchRegex },
                { 'customer.customercode': searchRegex },
                { 'customer.city': searchRegex },
                { 'customer.email': searchRegex },
                { status: searchRegex },
                { remark: searchRegex },
                { serialNumber: searchRegex },
                { 'items.equipment.name': searchRegex },
                { 'items.equipment.materialcode': searchRegex }
            ];
        }

        if (req.query.status) {
            baseQuery.status = req.query.status;
        }

        if (req.query.issuedBy) {
            baseQuery.issuedBy = req.query.issuedBy;
        }

        if (req.query.startDate || req.query.endDate) {
            baseQuery.createdAt = {};
            if (req.query.startDate) {
                baseQuery.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                baseQuery.createdAt.$lte = new Date(req.query.endDate);
            }
        }

        if (req.query.minAmount) {
            baseQuery.finalAmount = { $gte: parseFloat(req.query.minAmount) };
        }

        if (req.query.maxAmount) {
            baseQuery.finalAmount = {
                ...baseQuery.finalAmount,
                $lte: parseFloat(req.query.maxAmount)
            };
        }

        const total = await CNote.countDocuments(baseQuery);
        const totalPages = Math.ceil(total / limit);

        const cnotes = await CNote.find(baseQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('issuedBy', 'name email')
            .populate('items.RSHApproval.approvedBy', 'name')
            .populate('items.NSHApproval.approvedBy', 'name')
            .lean();

        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.json({
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
        });
    } catch (error) {
        console.error('CNote search error:', error);
        res.status(500).json({
            success: false,
            message: 'Error occurred during search',
            error: error.message
        });
    }
});

// Get all CNotes
router.get('/', async (req, res) => {
    try {
        const cnotes = await CNote.find()
            .sort({ createdAt: -1 })
            .populate('issuedBy', 'name email')
            .populate('items.RSHApproval.approvedBy', 'name')
            .populate('items.NSHApproval.approvedBy', 'name');

        res.json(cnotes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single CNote
router.get('/:cnoteNumber', async (req, res) => {
    try {
        const cnote = await CNote.findOne({ cnoteNumber: req.params.cnoteNumber })
            .populate('issuedBy', 'name email')
            .populate('items.RSHApproval.approvedBy', 'name')
            .populate('items.NSHApproval.approvedBy', 'name');

        if (!cnote) {
            return res.status(404).json({ message: 'CNote not found' });
        }

        res.json(cnote);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update CNote
router.put('/:cnoteNumber', async (req, res) => {
    try {
        const { cnoteNumber } = req.params;
        const updateData = req.body;

        const cnote = await CNote.findOneAndUpdate(
            { cnoteNumber },
            { ...updateData, updatedAt: Date.now() },
            { new: true }
        );

        if (!cnote) {
            return res.status(404).json({ message: 'CNote not found' });
        }

        res.json(cnote);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Issue CNote
router.post('/:cnoteNumber/issue', async (req, res) => {
    try {
        const { cnoteNumber } = req.params;

        const cnote = await CNote.findOneAndUpdate(
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
            return res.status(404).json({ message: 'CNote not found' });
        }

        res.json(cnote);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Cancel CNote
router.post('/:cnoteNumber/cancel', async (req, res) => {
    try {
        const { cnoteNumber } = req.params;
        const { reason } = req.body;

        const cnote = await CNote.findOneAndUpdate(
            { cnoteNumber },
            {
                status: 'cancelled',
                cancellationReason: reason,
                updatedAt: Date.now()
            },
            { new: true }
        );

        if (!cnote) {
            return res.status(404).json({ message: 'CNote not found' });
        }

        res.json(cnote);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete CNote
router.delete('/:cnoteNumber', async (req, res) => {
    try {
        const { cnoteNumber } = req.params;

        const session = await mongoose.startSession();

        try {
            let deletedCNote;

            await session.withTransaction(async () => {
                deletedCNote = await CNote.findOneAndDelete({ cnoteNumber }, { session });

                if (!deletedCNote) {
                    throw new Error('CNote not found');
                }

                // Delete PDF file if exists
                if (deletedCNote.pdfFileName) {
                    const pdfPath = path.join(uploadsDir, deletedCNote.pdfFileName);
                    if (fs.existsSync(pdfPath)) {
                        fs.unlinkSync(pdfPath);
                    }
                }

                // ✅ Clear both cnoteNumber and PDF info from proposal
                await Proposal.findOneAndUpdate(
                    { proposalNumber: deletedCNote.proposalNumber },
                    {
                        $unset: {
                            cnoteNumber: "",
                            pdfUrl: "",
                            pdfFileName: ""
                        }
                    },
                    { session }
                );
            });

            res.json({
                message: 'CNote deleted successfully',
                deletedCNote: {
                    cnoteNumber: deletedCNote.cnoteNumber,
                    proposalNumber: deletedCNote.proposalNumber
                }
            });

        } catch (transactionError) {
            await session.abortTransaction();
            if (transactionError.message === 'CNote not found') {
                return res.status(404).json({ message: 'CNote not found' });
            }
            throw transactionError;
        } finally {
            session.endSession();
        }

    } catch (error) {
        console.error('CNote deletion error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Route to download CNote PDF by proposal number
router.get('/proposal/:proposalNumber/cnote-pdf', async (req, res) => {
    try {
        const { proposalNumber } = req.params;

        // Find the proposal to get the PDF filename
        const proposal = await Proposal.findOne({ proposalNumber });

        if (!proposal) {
            return res.status(404).json({ message: 'Proposal not found' });
        }

        if (!proposal.pdfFileName || !proposal.pdfUrl) {
            return res.status(404).json({ message: 'CNote PDF not found for this proposal' });
        }

        // Construct the full file path
        const filePath = path.join(uploadsDir, proposal.pdfFileName);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'PDF file not found on server' });
        }

        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${proposal.pdfFileName}"`);

        // Send the file for download
        res.download(filePath, proposal.pdfFileName, (err) => {
            if (err) {
                console.error('Error downloading PDF:', err);
                if (!res.headersSent) {
                    res.status(500).json({ message: 'Error downloading PDF file' });
                }
            }
        });

    } catch (error) {
        console.error('PDF download error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
