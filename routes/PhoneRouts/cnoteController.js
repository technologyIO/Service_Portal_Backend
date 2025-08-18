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

// Email transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'webadmin@skanray-access.com',
        pass: 'rdzegwmzirvbjcpm'
    }
});

// Function to generate HTML template from CNote data
const generateHtmlTemplate = (cnoteData) => {
    const itemsHtml = cnoteData.items.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${item.equipment.name}</td>
            <td>${item.equipment.materialcode}</td>
            <td>${item.years * 12}</td>
            <td>1</td>
            <td>${item.pricePerYear.toLocaleString('en-IN')}</td>
            <td>${item.subtotal.toLocaleString('en-IN')}</td>
        </tr>
    `).join('');

    const totalInWords = numberToWords(cnoteData.finalAmount);

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
                <td></td>
                <td>Dealer Name</td>
                <td></td>
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

        <p>The undersigned hereby orders that afore-mentioned goods from Skamray Technologies Limited (Healthcare Division). The goods specified above to be delivered as per the condition of sales and terms of business set out in this contract. Seller's terms of business as printed overleaf are considered to form part of contract unless expressly overruled by any of the conditions stipulated therein.</p>

        <table class="signature-table">
            <tr>
                <th width="33%">Customer Signature and seal</th>
                <th width="34%">Accepted on behalf of Skamray Technologies Limited</th>
                <th width="33%">Regulatory Approval (If Applicable)</th>
            </tr>
            <tr>
                <td>Date:</td>
                <td>Digitally Accepted by SE: Sony Ponnanna_Sales :<br>Date: ${new Date().toLocaleDateString('en-GB')}</td>
                <td>Date:</td>
            </tr>
        </table>

        <div class="note">
            <p><strong>Form No : 3F5007 Rev# 6.0</strong></p>
            <p>Note: Effective from 1st Oct 2020, as per Govt Of India Notification TCS (Tax collection at Source) will be charged if applicable at the rate of 0.1% if PAN / Aadhaar is submitted other wise 1%</p>
            <p>Page 2 of 2</p>
        </div>

        <div class="footer">
            <p>Skamray Technologies Limited, Regd. Office: Plot #15-17, Hebbal Industrial Area, Mysuru - 570016, INDIA. P +91 8212415559 CIN U72206KA2007PLC041774 Healthcare Division: #360, KIADB Industrial Area, Hebbal, Mysuru - 570018, INDIA. P +91 8212407000 E office@skamray.com W www.skamray.com</p>
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

// Function to generate PDF using Puppeteer and send email
const generateAndSendPdf = async (cnoteData, res) => {
    let browser;
    let page;
    const maxRetries = 3;
    let retryCount = 0;
    let pdfBuffer = null;

    try {
        const htmlContent = generateHtmlTemplate(cnoteData);

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
            subject: `CNote Generated - ${cnoteData.cnoteNumber}`,
            text: `CNote ${cnoteData.cnoteNumber} for ${cnoteData.customer.customername}`,
            attachments: [
                {
                    filename: `CNote_${cnoteData.cnoteNumber}_${Date.now()}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        await transporter.sendMail(mailOptions);

        res.status(201).json({
            message: 'CNote created and email sent',
            cnote: cnoteData
        });

    } catch (error) {
        console.error('Final PDF generation failure:', error);

        res.status(500).json({
            message: 'CNote creation aborted - PDF generation failed',
            error: error.message
        });
    } finally {
        if (page && !page.isClosed()) await page.close();
        if (browser) await browser.close();
    }
};

// API endpoint to create CNote and send PDF
router.post('/', async (req, res) => {
    try {
        const { proposalId } = req.body;

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
            issuedBy: req.user?.id || null,
            cnoteNumber
        });

        // Use session for transaction to ensure both operations succeed
        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                // Save CNote
                await cnote.save({ session });

                // Update Proposal with cnoteNumber
                await Proposal.findByIdAndUpdate(
                    proposalId,
                    { cnoteNumber: cnoteNumber },
                    { session }
                );
            });

            // Generate PDF and send email
            await generateAndSendPdf(cnote, res);

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

        // Use session for transaction
        const session = await mongoose.startSession();

        try {
            let deletedCNote;

            await session.withTransaction(async () => {
                // Find and delete CNote
                deletedCNote = await CNote.findOneAndDelete({ cnoteNumber }, { session });

                if (!deletedCNote) {
                    throw new Error('CNote not found');
                }

                // Clear cnoteNumber from corresponding Proposal
                await Proposal.findOneAndUpdate(
                    { proposalNumber: deletedCNote.proposalNumber },
                    { $unset: { cnoteNumber: "" } }, // This will remove the field or set it to null
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


module.exports = router;