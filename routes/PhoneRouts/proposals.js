const express = require('express');
const router = express.Router();
const Proposal = require('../../Model/AppSchema/proposalSchema');
const nodemailer = require('nodemailer');
const User = require('../../Model/MasterSchema/UserSchema');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'webadmin@skanray-access.com',
        pass: 'rdzegwmzirvbjcpm'
    }
});

// Verify transporter connection on startup
transporter.verify((error) => {
    if (error) {
        console.error('Mail transporter error:', error);
    } else {
        // console.log('Mail transporter is ready');
    }
});
// Create a new proposal
router.post('/', async (req, res) => {
    try {
        const proposalData = req.body;
        let proposal;
        let retries = 3;
        let lastError;

        while (retries > 0) {
            try {
                proposal = new Proposal(proposalData);
                await proposal.save();
                break;
            } catch (error) {
                lastError = error;
                retries--;

                // Only retry on duplicate key errors
                if (error.code !== 11000) {
                    break;
                }

                // Small delay before retry
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        }

        if (!proposal) {
            // Handle the error after all retries failed
            if (lastError.code === 11000) {
                return res.status(409).json({
                    message: "Failed to generate unique proposal number after multiple attempts",
                    error: "Duplicate key error"
                });
            }
            throw lastError;
        }

        res.status(201).json(proposal);
    } catch (error) {
        // Handle other errors
        if (error.name === 'ValidationError') {
            const errors = Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message
            }));
            return res.status(400).json({
                message: "Validation failed",
                errors: errors
            });
        }

        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
});

router.get('/all', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const proposals = await Proposal.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Proposal.countDocuments({});
        const totalPages = Math.ceil(total / limit);

        res.json({
            records: proposals,
            totalPages,
            total,
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/paginated', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // ✅ No default status filter anymore
        const query = {};

        // Optional filter by createdBy
        if (req.query.createdBy) {
            query.createdBy = req.query.createdBy;
        }

        // Optional filter by status (only if explicitly passed from frontend)
        if (req.query.status) {
            query.status = req.query.status;
        }

        const proposals = await Proposal.find(query)
            .populate('customer', 'customername')
            .populate('items')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Proposal.countDocuments(query);
        const totalPages = Math.ceil(total / limit);

        res.json({
            data: proposals,
            totalPages,
            total,
            currentPage: page,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Search proposals with pagination
router.get('/search', async (req, res) => {
    try {
        // Extract query parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const searchTerm = req.query.q || req.query.search || '';

        // Base query (no status filter now)
        let baseQuery = {};

        // Build search query if search term is provided
        if (searchTerm.trim()) {
            const searchRegex = new RegExp(searchTerm.trim(), 'i'); // case insensitive

            baseQuery = {
                ...baseQuery,
                $or: [
                    { proposalNumber: searchRegex },
                    { cnoteNumber: searchRegex },
                    { 'customer.customername': searchRegex },
                    { remark: searchRegex },
                    { 'items.equipment.equipmentname': searchRegex },
                    { 'items.equipment.model': searchRegex },
                    { 'items.equipment.brand': searchRegex }
                ]
            };
        }

        // Add additional filters if needed
        if (req.query.createdBy) {
            baseQuery.createdBy = req.query.createdBy;
        }

        // Filter by discount percentage if provided
        if (req.query.minDiscount) {
            baseQuery.discountPercentage = {
                $gte: parseFloat(req.query.minDiscount)
            };
        }

        if (req.query.maxDiscount) {
            baseQuery.discountPercentage = {
                ...baseQuery.discountPercentage,
                $lte: parseFloat(req.query.maxDiscount)
            };
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

        // Execute search with pagination
        const proposals = await Proposal.find(baseQuery)
            .populate('customer', 'customername customercode')
            .populate('items.equipment', 'equipmentname model brand')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(); // Use lean() for better performance

        // Get total count for pagination
        const total = await Proposal.countDocuments(baseQuery);
        const totalPages = Math.ceil(total / limit);

        // Calculate pagination info
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        // Prepare response
        const response = {
            success: true,
            data: proposals,
            pagination: {
                currentPage: page,
                totalPages,
                totalRecords: total,
                recordsPerPage: limit,
                recordsOnPage: proposals.length,
                hasNext,
                hasPrev,
                nextPage: hasNext ? page + 1 : null,
                prevPage: hasPrev ? page - 1 : null
            },
            search: {
                query: searchTerm,
                totalMatches: total,
                filters: {
                    minDiscount: req.query.minDiscount || null,
                    maxDiscount: req.query.maxDiscount || null,
                    startDate: req.query.startDate || null,
                    endDate: req.query.endDate || null,
                    createdBy: req.query.createdBy || null
                }
            }
        };

        res.json(response);

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Error occurred during search',
            error: error.message
        });
    }
});


router.get('/allcompleted', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Only fetch completed proposals
        const query = { status: "completed" };

        const proposals = await Proposal.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Proposal.countDocuments(query);
        const totalPages = Math.ceil(total / limit);

        res.json({
            records: proposals,
            totalPages,
            total,
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all proposals
router.get('/', async (req, res) => {
    try {
        const proposals = await Proposal.find().sort({ createdAt: -1 });
        res.json(proposals);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get a single proposal by ID
router.get('/:id', async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id);
        if (!proposal) {
            return res.status(404).json({ message: 'Proposal not found' });
        }
        res.json(proposal);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
router.get('/customer/:customerId', async (req, res) => {
    try {
        const { customerId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const searchTerm = req.query.q || req.query.search || '';

        // ✅ Base query only by customerId (no default status filter)
        let baseQuery = {
            'customer.customercodeid': customerId
        };

        // Add search functionality if search term is provided
        if (searchTerm.trim()) {
            const searchRegex = new RegExp(searchTerm.trim(), 'i');
            baseQuery = {
                ...baseQuery,
                $or: [
                    { proposalNumber: searchRegex },
                    { cnoteNumber: searchRegex },
                    { 'customer.customername': searchRegex },
                    { status: searchRegex },
                    { remark: searchRegex },
                    { 'items.equipment.equipmentname': searchRegex },
                    { 'items.equipment.model': searchRegex },
                    { 'items.equipment.brand': searchRegex }
                ]
            };
        }

        // Optional status filter (only if frontend passes it)
        if (req.query.status) {
            baseQuery.status = req.query.status;
        }

        // Discount filters
        if (req.query.minDiscount) {
            baseQuery.discountPercentage = {
                $gte: parseFloat(req.query.minDiscount)
            };
        }

        if (req.query.maxDiscount) {
            baseQuery.discountPercentage = {
                ...baseQuery.discountPercentage,
                $lte: parseFloat(req.query.maxDiscount)
            };
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

        // Execute query with pagination
        const proposals = await Proposal.find(baseQuery)
            .populate('customer', 'customername customercode city email telephone')
            .populate('items.equipment', 'equipmentname model brand')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Proposal.countDocuments(baseQuery);
        const totalPages = Math.ceil(total / limit);

        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        const customerInfo = proposals.length > 0 ? proposals[0].customer : null;

        if (!customerInfo && proposals.length === 0) {
            const anyProposal = await Proposal.findOne(
                { 'customer.customercodeid': customerId },
                { customer: 1 }
            ).lean();

            if (!anyProposal) {
                return res.status(404).json({
                    success: false,
                    message: 'No proposals found for this customer',
                    data: [],
                    customer: null,
                    pagination: {
                        currentPage: page,
                        totalPages: 0,
                        totalRecords: 0,
                        recordsPerPage: limit,
                        recordsOnPage: 0,
                        hasNext: false,
                        hasPrev: false,
                        nextPage: null,
                        prevPage: null
                    }
                });
            }
        }

        res.json({
            success: true,
            message: `Found ${total} proposals for customer ${customerId}`,
            data: proposals,
            customer: customerInfo,
            pagination: {
                currentPage: page,
                totalPages,
                totalRecords: total,
                recordsPerPage: limit,
                recordsOnPage: proposals.length,
                hasNext,
                hasPrev,
                nextPage: hasNext ? page + 1 : null,
                prevPage: hasPrev ? page - 1 : null
            },
            filters: {
                customerId,
                search: searchTerm || null,
                status: req.query.status || null,
                minDiscount: req.query.minDiscount || null,
                maxDiscount: req.query.maxDiscount || null,
                startDate: req.query.startDate || null,
                endDate: req.query.endDate || null
            }
        });

    } catch (error) {
        console.error('Error fetching customer proposals:', error);
        res.status(500).json({
            success: false,
            message: 'Error occurred while fetching customer proposals',
            error: error.message,
            data: [],
            customer: null
        });
    }
});
router.get('/customercmcclose/:customerId', async (req, res) => {
    try {
        const { customerId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const searchTerm = req.query.q || req.query.search || '';

        // ✅ Base query: exclude proposals with Cmcncmcsostatus = "Open"
        let baseQuery = {
            'customer.customercodeid': customerId,
            Cmcncmcsostatus: { $ne: "Open" }
        };

        // Add search functionality
        if (searchTerm.trim()) {
            const searchRegex = new RegExp(searchTerm.trim(), 'i');
            baseQuery = {
                ...baseQuery,
                $or: [
                    { proposalNumber: searchRegex },
                    { cnoteNumber: searchRegex },
                    { 'customer.customername': searchRegex },
                    { status: searchRegex },
                    { remark: searchRegex },
                    { 'items.equipment.equipmentname': searchRegex },
                    { 'items.equipment.model': searchRegex },
                    { 'items.equipment.brand': searchRegex }
                ]
            };
        }

        // Optional status filter
        if (req.query.status) {
            baseQuery.status = req.query.status;
        }

        // Discount filters
        if (req.query.minDiscount) {
            baseQuery.discountPercentage = {
                $gte: parseFloat(req.query.minDiscount)
            };
        }

        if (req.query.maxDiscount) {
            baseQuery.discountPercentage = {
                ...baseQuery.discountPercentage,
                $lte: parseFloat(req.query.maxDiscount)
            };
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

        // Execute query
        const proposals = await Proposal.find(baseQuery)
            .populate('customer', 'customername customercode city email telephone')
            .populate('items.equipment', 'equipmentname model brand')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Proposal.countDocuments(baseQuery);
        const totalPages = Math.ceil(total / limit);

        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        const customerInfo = proposals.length > 0 ? proposals[0].customer : null;

        res.json({
            success: true,
            message: `Found ${total} proposals for customer ${customerId}`,
            data: proposals,
            customer: customerInfo,
            pagination: {
                currentPage: page,
                totalPages,
                totalRecords: total,
                recordsPerPage: limit,
                recordsOnPage: proposals.length,
                hasNext,
                hasPrev,
                nextPage: hasNext ? page + 1 : null,
                prevPage: hasPrev ? page - 1 : null
            },
            filters: {
                customerId,
                search: searchTerm || null,
                status: req.query.status || null,
                minDiscount: req.query.minDiscount || null,
                maxDiscount: req.query.maxDiscount || null,
                startDate: req.query.startDate || null,
                endDate: req.query.endDate || null
            }
        });

    } catch (error) {
        console.error('Error fetching customer proposals:', error);
        res.status(500).json({
            success: false,
            message: 'Error occurred while fetching customer proposals',
            error: error.message,
            data: [],
            customer: null
        });
    }
});

// Update a proposal (regular update)
router.put('/:id', async (req, res) => {
    try {
        const proposal = await Proposal.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: Date.now() },
            { new: true, runValidators: true }
        );
        if (!proposal) {
            return res.status(404).json({ message: 'Proposal not found' });
        }
        res.json(proposal);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});
router.put('/:id/update-proposal-status', async (req, res) => {
    try {
        const { Cmcncmcsostatus, proposalRemark } = req.body;

        if (!Cmcncmcsostatus) {
            return res.status(400).json({
                success: false,
                message: 'Cmcncmcsostatus is required'
            });
        }

        // Create update object
        const updateFields = {
            Cmcncmcsostatus,
            updatedAt: Date.now()
        };

        // Add remark only if provided
        if (proposalRemark !== undefined) {
            updateFields.proposalRemark = proposalRemark;
        }

        const proposal = await Proposal.findByIdAndUpdate(
            req.params.id,
            {
                $set: updateFields,
                $push: {
                    statusHistory: {
                        status: `proposal_${Cmcncmcsostatus.toLowerCase()}`,
                        changedAt: Date.now(),
                        changedBy: req.user ? req.user._id : null,
                        note: proposalRemark || `Proposal status changed to ${Cmcncmcsostatus}`
                    }
                }
            },
            { new: true, runValidators: true }
        );

        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: 'Proposal not found'
            });
        }

        res.json({
            success: true,
            message: `Proposal status updated to ${Cmcncmcsostatus}`,
            data: proposal
        });
    } catch (error) {
        console.error('Proposal status update error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during proposal status update',
            error: error.message
        });
    }
});

// Add or Update CoNumber and set status to completed
router.put('/:id/update-conumber', async (req, res) => {
    try {
        const { CoNumber } = req.body;

        if (!CoNumber) {
            return res.status(400).json({
                success: false,
                message: 'CoNumber is required'
            });
        }

        const proposal = await Proposal.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    CoNumber: CoNumber,
                    status: 'completed',
                    Cmcncmcsostatus: 'CLOSED_WON',
                    updatedAt: Date.now()
                },
                $push: {
                    statusHistory: {
                        status: 'completed',
                        changedAt: Date.now(),
                        changedBy: req.user ? req.user._id : null
                    }
                }
            },
            { new: true, runValidators: true }
        );

        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: 'Proposal not found'
            });
        }

        res.json({
            success: true,
            message: 'CoNumber updated, status set to completed, Cmcncmcsostatus closed won',
            data: proposal
        });
    } catch (error) {
        console.error('Proposal update error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during update',
            error: error.message
        });
    }
});

// Create a new revision
router.post('/:id/revisions', async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id);
        if (!proposal) {
            return res.status(404).json({ message: 'Proposal not found' });
        }

        const newRevisionNumber = proposal.currentRevision + 1;
        const revisionData = {
            revisionNumber: newRevisionNumber,
            changes: {
                discountPercentage: req.body.discountPercentage,
                discountAmount: req.body.discountAmount,
                afterDiscount: req.body.afterDiscount,
                tdsAmount: req.body.tdsAmount,
                afterTds: req.body.afterTds,
                gstAmount: req.body.gstAmount,
                finalAmount: req.body.finalAmount,
                remark: req.body.remark || 'Revision ' + newRevisionNumber
            }
        };

        // Update main proposal with new values
        const updatedProposal = await Proposal.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    discountPercentage: req.body.discountPercentage,
                    discountAmount: req.body.discountAmount,
                    afterDiscount: req.body.afterDiscount,
                    tdsAmount: req.body.tdsAmount,
                    afterTds: req.body.afterTds,
                    gstAmount: req.body.gstAmount,
                    finalAmount: req.body.finalAmount,
                    remark: req.body.remark,
                    status: 'revised',
                    currentRevision: newRevisionNumber,
                    updatedAt: Date.now()
                },
                $push: { revisions: revisionData }
            },
            { new: true }
        );

        res.status(201).json(updatedProposal);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.put('/:id/revision', async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id);
        if (!proposal) {
            return res.status(404).json({ message: 'Proposal not found' });
        }

        const newRevisionNumber = proposal.currentRevision + 1;
        const { discountPercentage } = req.body;

        // Calculate amounts
        const grandSubTotal = proposal.grandSubTotal;
        const discountAmount = grandSubTotal * (discountPercentage / 100);
        const afterDiscount = grandSubTotal - discountAmount;
        const tdsAmount = afterDiscount * (proposal.tdsPercentage / 100);
        const afterTds = afterDiscount - tdsAmount;
        const gstAmount = afterTds * (proposal.gstPercentage / 100);
        const finalAmount = afterTds + gstAmount;

        const remarkText = req.body.remark || `Revision ${newRevisionNumber}`;
        const revisionData = {
            revisionNumber: newRevisionNumber,
            changes: {
                discountPercentage,
                discountAmount,
                afterDiscount,
                tdsAmount,
                afterTds,
                gstAmount,
                finalAmount,
                remark: remarkText
            }
        };

        // Clear approvals inside each item
        const updatedItems = proposal.items.map(item => ({
            ...item.toObject(),
            RSHApproval: {
                approved: false,
                approvedBy: null,
                approvedAt: null
            },
            NSHApproval: {
                approved: false,
                approvedBy: null,
                approvedAt: null
            }
        }));

        // Update proposal
        const updatedProposal = await Proposal.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    discountPercentage,
                    discountAmount,
                    afterDiscount,
                    tdsAmount,
                    afterTds,
                    gstAmount,
                    finalAmount,
                    remark: remarkText,
                    status: 'revised',
                    currentRevision: newRevisionNumber,
                    updatedAt: Date.now(),
                    RSHApproval: {
                        approved: false,
                        approvedBy: null,
                        approvedAt: null
                    },
                    NSHApproval: {
                        approved: false,
                        approvedBy: null,
                        approvedAt: null
                    },
                    items: updatedItems
                },
                $push: { revisions: revisionData }
            },
            { new: true }
        );

        // Email setup
        const proposalLink = `https://service-portal-admin.vercel.app/proposal/${req.params.id}`;
        const mailOptions = {
            from: 'webadmin@skanray-access.com',
            to: 'ftshivamtiwari222@gmail.com', // Replace with actual recipient
            subject: `Proposal Revision #${newRevisionNumber} - Approval Needed`,
            html: `
                <p>Dear CIC,</p>
                <p>A new revision (<strong>#${newRevisionNumber}</strong>) has been made for the proposal with ID <strong>${proposal._id}</strong>.</p>
                <p><strong>Final Amount:</strong> ₹${finalAmount.toFixed(2)}</p>
                <p><strong>Remark:</strong> ${remarkText}</p>
                <p>Please review and take action (Approve or Reject) at the following link:</p>
                <p><a href="${proposalLink}">${proposalLink}</a></p>
                <br/>
                <p>Regards,<br/>Proposal Management System</p>
            `
        };

        let emailSent = false;
        try {
            await transporter.sendMail(mailOptions);
            emailSent = true;
            console.log('Revision email sent successfully');
        } catch (emailError) {
            console.error('Failed to send revision email:', emailError);
            // Continue with the response even if email fails
        }

        res.status(200).json({
            message: `Proposal revised successfully${emailSent ? ' and email sent to CIC' : ' but email failed to send'}.`,
            updatedProposal,
            emailSent
        });

    } catch (error) {
        console.error("Error in revision endpoint:", error);
        res.status(500).json({
            message: 'An error occurred while processing revision',
            error: error.message
        });
    }
});


// Get all revisions for a proposal
router.get('/:id/revisions', async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id);
        if (!proposal) {
            return res.status(404).json({ message: 'Proposal not found' });
        }
        res.json(proposal.revisions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// Approve by RSH (updated version)
// Bulk RSH Approval Route
router.put('/:id/bulk-approve-rsh', async (req, res) => {
    try {
        const { userId, itemIds, remark } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Item IDs array is required'
            });
        }

        const proposal = await Proposal.findById(req.params.id);
        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: 'Proposal not found'
            });
        }

        const updatedItems = [];

        // Process each item
        for (const itemId of itemIds) {
            const item = proposal.items.id(itemId);
            if (item) {
                item.RSHApproval = {
                    approved: true,
                    approvedBy: userId,
                    approvedAt: new Date(),
                    remark: remark || ''
                };

                // Update equipment status if conditions are met
                const requiresNSHApproval = proposal.discountPercentage > 10;
                if ((requiresNSHApproval && item.NSHApproval?.approved) || (!requiresNSHApproval)) {
                    item.equipment.status = 'Approved';
                }

                updatedItems.push(itemId);
            }
        }

        // Update revision status
        const currentRevision = proposal.revisions.find(rev => rev.revisionNumber === proposal.currentRevision);
        if (currentRevision) {
            currentRevision.approvalHistory.push({
                status: 'approved',
                changedAt: new Date(),
                changedBy: userId,
                approvalType: 'RSH',
                remark: remark || '',
                itemIds: updatedItems,
                bulkAction: true
            });

            // Check if revision should be marked as approved
            const requiresNSHApproval = proposal.discountPercentage > 10;
            if (!requiresNSHApproval) {
                const allRSHApproved = proposal.items.every(item => item.RSHApproval?.approved);
                if (allRSHApproved) {
                    currentRevision.status = 'approved';
                }
            } else {
                // Check if both RSH and NSH have approved all items
                const allRSHApproved = proposal.items.every(item => item.RSHApproval?.approved);
                const allNSHApproved = proposal.items.every(item => item.NSHApproval?.approved);
                if (allRSHApproved && allNSHApproved) {
                    currentRevision.status = 'approved';
                }
            }
        }

        // Update proposal status
        const requiresNSHApproval = proposal.discountPercentage > 10;
        let allApproved = true;

        for (const item of proposal.items) {
            if (requiresNSHApproval) {
                if (!item.RSHApproval?.approved || !item.NSHApproval?.approved) {
                    allApproved = false;
                    break;
                }
            } else {
                if (!item.RSHApproval?.approved) {
                    allApproved = false;
                    break;
                }
            }
        }

        proposal.approvalProposalStatus = allApproved ? 'Approved' : 'InProgress';
        proposal.updatedAt = new Date();
        await proposal.save();

        res.json({
            success: true,
            message: `${updatedItems.length} items approved by RSH`,
            data: proposal
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error during bulk RSH approval',
            error: error.message
        });
    }
});

// Bulk NSH Approval Route
router.put('/:id/bulk-approve-nsh', async (req, res) => {
    try {
        const { userId, itemIds, remark } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Item IDs array is required'
            });
        }

        const proposal = await Proposal.findById(req.params.id);
        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: 'Proposal not found'
            });
        }

        const updatedItems = [];

        // Process each item
        for (const itemId of itemIds) {
            const item = proposal.items.id(itemId);
            if (item) {
                item.NSHApproval = {
                    approved: true,
                    approvedBy: userId,
                    approvedAt: new Date(),
                    remark: remark || ''
                };

                // Update equipment status if conditions are met
                const requiresNSHApproval = proposal.discountPercentage > 10;
                if ((requiresNSHApproval && item.RSHApproval?.approved) || !requiresNSHApproval) {
                    item.equipment.status = 'Approved';
                }

                updatedItems.push(itemId);
            }
        }

        // Update revision status
        const currentRevision = proposal.revisions.find(rev => rev.revisionNumber === proposal.currentRevision);
        if (currentRevision) {
            currentRevision.approvalHistory.push({
                status: 'approved',
                changedAt: new Date(),
                changedBy: userId,
                approvalType: 'NSH',
                remark: remark || '',
                itemIds: updatedItems,
                bulkAction: true
            });

            // Check if revision should be marked as approved
            const requiresNSHApproval = proposal.discountPercentage > 10;
            if (requiresNSHApproval) {
                const allRSHApproved = proposal.items.every(item => item.RSHApproval?.approved);
                const allNSHApproved = proposal.items.every(item => item.NSHApproval?.approved);
                if (allRSHApproved && allNSHApproved) {
                    currentRevision.status = 'approved';
                }
            } else {
                const allRSHApproved = proposal.items.every(item => item.RSHApproval?.approved);
                if (allRSHApproved) {
                    currentRevision.status = 'approved';
                }
            }
        }

        // Update proposal status
        const requiresNSHApproval = proposal.discountPercentage > 10;
        let allApproved = true;

        for (const item of proposal.items) {
            if (requiresNSHApproval) {
                if (!item.RSHApproval?.approved || !item.NSHApproval?.approved) {
                    allApproved = false;
                    break;
                }
            } else {
                if (!item.RSHApproval?.approved) {
                    allApproved = false;
                    break;
                }
            }
        }

        proposal.approvalProposalStatus = allApproved ? 'Approved' : 'InProgress';
        proposal.updatedAt = new Date();
        await proposal.save();

        res.json({
            success: true,
            message: `${updatedItems.length} items approved by NSH`,
            data: proposal
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error during bulk NSH approval',
            error: error.message
        });
    }
});

// Bulk Reject Route
router.put('/:id/bulk-reject-revision', async (req, res) => {
    try {
        const { userId, reason, approvalType, itemIds } = req.body;

        if (!userId || !reason) {
            return res.status(400).json({
                success: false,
                message: 'User ID and rejection reason are required'
            });
        }

        if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Item IDs array is required'
            });
        }

        const proposal = await Proposal.findById(req.params.id);
        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: 'Proposal not found'
            });
        }

        const currentRevision = proposal.revisions.find(rev =>
            rev.revisionNumber === proposal.currentRevision
        );

        if (!currentRevision) {
            return res.status(404).json({
                success: false,
                message: 'Current revision not found'
            });
        }

        const rejectedItems = [];

        // Process each item
        for (const itemId of itemIds) {
            const item = proposal.items.id(itemId);
            if (item) {
                if (approvalType === 'RSH') {
                    item.RSHApproval = {
                        approved: false,
                        rejected: true,
                        rejectedBy: userId,
                        rejectedAt: new Date(),
                        reason: reason
                    };
                } else if (approvalType === 'NSH') {
                    item.NSHApproval = {
                        approved: false,
                        rejected: true,
                        rejectedBy: userId,
                        rejectedAt: new Date(),
                        reason: reason
                    };
                }

                // Update equipment status to rejected/pending
                item.equipment.status = 'Rejected';
                rejectedItems.push(itemId);
            }
        }

        // Update revision approval history
        currentRevision.approvalHistory.push({
            approvalType: approvalType || 'revision',
            status: 'rejected',
            changedAt: new Date(),
            changedBy: userId,
            remark: reason,
            itemIds: rejectedItems,
            bulkAction: true
        });

        // Update revision and proposal status
        proposal.approvalProposalStatus = 'InProgress';

        // Check if entire revision should be marked as rejected
        const totalItems = proposal.items.length;
        const rejectedRSHItems = proposal.items.filter(item => item.RSHApproval?.rejected).length;
        const rejectedNSHItems = proposal.items.filter(item => item.NSHApproval?.rejected).length;

        if (rejectedRSHItems > 0 || rejectedNSHItems > 0) {
            // If any items are rejected, mark revision as needs revision
            currentRevision.status = 'needs_revision';
        }

        proposal.updatedAt = new Date();
        await proposal.save();

        res.json({
            success: true,
            message: `${rejectedItems.length} items rejected by ${approvalType}`,
            data: proposal
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error during bulk rejection',
            error: error.message
        });
    }
});

// Updated single item routes to include remark support
router.put('/:id/approve-rsh', async (req, res) => {
    try {
        const { userId, itemId, remark } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const proposal = await Proposal.findById(req.params.id);
        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: 'Proposal not found'
            });
        }

        // If itemId is provided, update specific item
        if (itemId) {
            const item = proposal.items.id(itemId);
            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: 'Item not found'
                });
            }

            item.RSHApproval = {
                approved: true,
                approvedBy: userId,
                approvedAt: new Date(),
                remark: remark || ''
            };

            // Update equipment status if conditions are met
            const requiresNSHApproval = proposal.discountPercentage > 10;
            if ((requiresNSHApproval && item.NSHApproval?.approved) || (!requiresNSHApproval)) {
                item.equipment.status = 'Approved';
            }
        } else {
            // Update all items
            proposal.items.forEach(item => {
                item.RSHApproval = {
                    approved: true,
                    approvedBy: userId,
                    approvedAt: new Date(),
                    remark: remark || ''
                };

                const requiresNSHApproval = proposal.discountPercentage > 10;
                if ((requiresNSHApproval && item.NSHApproval?.approved) || (!requiresNSHApproval)) {
                    item.equipment.status = 'Approved';
                }
            });
        }

        // Update revision status
        const currentRevision = proposal.revisions.find(rev => rev.revisionNumber === proposal.currentRevision);
        if (currentRevision) {
            currentRevision.approvalHistory.push({
                status: 'approved',
                changedAt: new Date(),
                changedBy: userId,
                approvalType: 'RSH',
                remark: remark || '',
                itemId: itemId || null
            });

            // Check if revision should be marked as approved
            const requiresNSHApproval = proposal.discountPercentage > 10;
            if (!requiresNSHApproval) {
                const allRSHApproved = proposal.items.every(item => item.RSHApproval?.approved);
                if (allRSHApproved) {
                    currentRevision.status = 'approved';
                }
            } else {
                const allRSHApproved = proposal.items.every(item => item.RSHApproval?.approved);
                const allNSHApproved = proposal.items.every(item => item.NSHApproval?.approved);
                if (allRSHApproved && allNSHApproved) {
                    currentRevision.status = 'approved';
                }
            }
        }

        // Update proposal status
        const requiresNSHApproval = proposal.discountPercentage > 10;
        let allApproved = true;

        for (const item of proposal.items) {
            if (requiresNSHApproval) {
                if (!item.RSHApproval?.approved || !item.NSHApproval?.approved) {
                    allApproved = false;
                    break;
                }
            } else {
                if (!item.RSHApproval?.approved) {
                    allApproved = false;
                    break;
                }
            }
        }

        proposal.approvalProposalStatus = allApproved ? 'Approved' : 'InProgress';
        proposal.updatedAt = new Date();
        await proposal.save();

        res.json({
            success: true,
            data: proposal
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error during approval',
            error: error.message
        });
    }
});

router.put('/:id/approve-nsh', async (req, res) => {
    try {
        const { userId, itemId, remark } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const proposal = await Proposal.findById(req.params.id);
        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: 'Proposal not found'
            });
        }

        // If itemId is provided, update specific item
        if (itemId) {
            const item = proposal.items.id(itemId);
            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: 'Item not found'
                });
            }

            item.NSHApproval = {
                approved: true,
                approvedBy: userId,
                approvedAt: new Date(),
                remark: remark || ''
            };

            // Update equipment status if conditions are met
            const requiresNSHApproval = proposal.discountPercentage > 10;
            if ((requiresNSHApproval && item.RSHApproval?.approved) || !requiresNSHApproval) {
                item.equipment.status = 'Approved';
            }
        } else {
            // Update all items
            proposal.items.forEach(item => {
                item.NSHApproval = {
                    approved: true,
                    approvedBy: userId,
                    approvedAt: new Date(),
                    remark: remark || ''
                };

                // Update equipment status if conditions are met
                const requiresNSHApproval = proposal.discountPercentage > 10;
                if ((requiresNSHApproval && item.RSHApproval?.approved) || !requiresNSHApproval) {
                    item.equipment.status = 'Approved';
                }
            });
        }

        // Update revision status
        const currentRevision = proposal.revisions.find(rev => rev.revisionNumber === proposal.currentRevision);
        if (currentRevision) {
            currentRevision.approvalHistory.push({
                status: 'approved',
                changedAt: new Date(),
                changedBy: userId,
                approvalType: 'NSH',
                remark: remark || '',
                itemId: itemId || null
            });

            // Check if revision should be marked as approved
            const requiresNSHApproval = proposal.discountPercentage > 10;
            if (requiresNSHApproval) {
                const allRSHApproved = proposal.items.every(item => item.RSHApproval?.approved);
                const allNSHApproved = proposal.items.every(item => item.NSHApproval?.approved);
                if (allRSHApproved && allNSHApproved) {
                    currentRevision.status = 'approved';
                }
            } else {
                const allRSHApproved = proposal.items.every(item => item.RSHApproval?.approved);
                if (allRSHApproved) {
                    currentRevision.status = 'approved';
                }
            }
        }

        // Update proposal status
        const requiresNSHApproval = proposal.discountPercentage > 10;
        let allApproved = true;

        for (const item of proposal.items) {
            if (requiresNSHApproval) {
                if (!item.RSHApproval?.approved || !item.NSHApproval?.approved) {
                    allApproved = false;
                    break;
                }
            } else {
                if (!item.RSHApproval?.approved) {
                    allApproved = false;
                    break;
                }
            }
        }

        proposal.approvalProposalStatus = allApproved ? 'Approved' : 'InProgress';
        proposal.updatedAt = new Date();
        await proposal.save();

        res.json({
            success: true,
            data: proposal
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error during approval',
            error: error.message
        });
    }
});

// Add a new route to reject a revision
router.put('/:id/reject-revision', async (req, res) => {
    try {
        const { userId, reason, approvalType, itemId } = req.body;

        if (!userId || !reason) {
            return res.status(400).json({
                success: false,
                message: 'User ID and rejection reason are required'
            });
        }

        const proposal = await Proposal.findById(req.params.id);
        if (!proposal) {
            return res.status(404).json({
                success: false,
                message: 'Proposal not found'
            });
        }

        const currentRevision = proposal.revisions.find(rev =>
            rev.revisionNumber === proposal.currentRevision
        );

        if (!currentRevision) {
            return res.status(404).json({
                success: false,
                message: 'Current revision not found'
            });
        }

        // Update approval history
        currentRevision.approvalHistory.push({
            approvalType: approvalType || 'revision',
            status: 'rejected',
            changedAt: new Date(),
            changedBy: userId,
            remark: reason
        });

        // Handle item-level rejection if itemId is provided
        if (itemId) {
            const item = proposal.items.id(itemId);
            if (item) {
                if (approvalType === 'RSH') {
                    item.RSHApproval = {
                        approved: false,
                        rejected: true,
                        rejectedBy: userId,
                        rejectedAt: new Date(),
                        reason: reason
                    };
                } else if (approvalType === 'NSH') {
                    item.NSHApproval = {
                        approved: false,
                        rejected: true,
                        rejectedBy: userId,
                        rejectedAt: new Date(),
                        reason: reason
                    };
                }
            }

            // Check if both RSH and NSH have rejected this revision
            const rshRejected = currentRevision.approvalHistory.some(
                h => h.approvalType === 'RSH' && h.status === 'rejected'
            );
            const nshRejected = currentRevision.approvalHistory.some(
                h => h.approvalType === 'NSH' && h.status === 'rejected'
            );

            if (rshRejected && nshRejected) {
                currentRevision.status = 'rejected';
                proposal.approvalProposalStatus = 'InProgress';
            }
        } else {
            // Whole revision rejection
            currentRevision.status = 'rejected';
            proposal.approvalProposalStatus = 'InProgress';
        }

        proposal.updatedAt = new Date();
        await proposal.save();

        res.json({
            success: true,
            data: proposal
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error during rejection',
            error: error.message
        });
    }
});

// Get a specific revision
router.get('/:id/revisions/:revisionNumber', async (req, res) => {
    try {
        const proposal = await Proposal.findOne({
            _id: req.params.id,
            'revisions.revisionNumber': parseInt(req.params.revisionNumber)
        }, {
            'revisions.$': 1
        });

        if (!proposal || !proposal.revisions || proposal.revisions.length === 0) {
            return res.status(404).json({ message: 'Revision not found' });
        }

        res.json(proposal.revisions[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete a proposal
router.delete('/:id', async (req, res) => {
    try {
        const proposal = await Proposal.findByIdAndDelete(req.params.id);
        if (!proposal) {
            return res.status(404).json({ message: 'Proposal not found' });
        }
        res.json({ message: 'Proposal deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



module.exports = router;