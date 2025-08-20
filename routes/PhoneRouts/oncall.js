const express = require('express');
const router = express.Router();
const OnCall = require('../../Model/AppSchema/onCallSchema');

const errorResponse = (res, statusCode, message, errorDetails = null) => {
    const response = {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
        ...(errorDetails && { details: errorDetails })
    };
    return res.status(statusCode).json(response);
};


// Middleware: Validate OnCall Request
const validateOnCallRequest = (req, res, next) => {
    const { customer, complaint, complaintDetails } = req.body;

    if (!customer) {
        return errorResponse(res, 400, 'Customer details are required', {
            receivedFields: Object.keys(req.body)
        });
    }

    if (!complaint && !complaintDetails) {
        return errorResponse(res, 400, 'Complaint details are required', {
            receivedFields: Object.keys(req.body)
        });
    }

    // Normalize to `complaint`
    req.body.complaint = complaintDetails || complaint;
    next();
};
// Pagecall route - MUST be before any '/:id' route!
router.get('/pagecall', async (req, res) => {
    try {
        const filters = { ...req.query };

        // Pagination parameters
        const page = parseInt(filters.page) || 1;
        const limit = parseInt(filters.limit) || 10;
        const skip = (page - 1) * limit;

        // Base query (no status filter at all now)
        const query = {};

        if (filters.createdBy) {
            query.createdBy = filters.createdBy;
        }

        // Fetch data with pagination
        const onCalls = await OnCall.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalOnCalls = await OnCall.countDocuments(query);
        const totalPages = Math.ceil(totalOnCalls / limit);

        return res.json({
            success: true,
            message: `${onCalls.length} OnCall(s) fetched`,
            data: onCalls,
            totalPages,
            totalOnCalls,
            currentPage: page
        });
    } catch (err) {
        console.error('[OnCall] Fetch Error:', err.message);
        return res.status(500).json({
            message: 'Failed to fetch OnCalls',
            error: err.message
        });
    }
});

// Search OnCalls with pagination
router.get('/search', async (req, res) => {
    try {
        // Extract query parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const searchTerm = req.query.q || req.query.search || '';

        // Base query to exclude completed OnCalls
        let baseQuery = { status: { $ne: "completed" } };

        // Build search query if search term is provided
        if (searchTerm.trim()) {
            const searchRegex = new RegExp(searchTerm.trim(), 'i'); // case insensitive

            baseQuery = {
                ...baseQuery,
                $or: [
                    { onCallNumber: searchRegex },
                    { 'customer.customername': searchRegex },
                    { 'customer.customercode': searchRegex },
                    { status: searchRegex },
                    { remark: searchRegex },
                    { 'complaint.notification_complaintid': searchRegex },
                    { 'complaint.complaintType': searchRegex },
                    { 'complaint.serialnumber': searchRegex },
                    { 'complaint.complaintDetails': searchRegex },
                    { 'complaint.priorityLevel': searchRegex },
                    { CoNumber: searchRegex }
                ]
            };
        }

        // Add additional filters if needed
        if (req.query.status && req.query.status !== "completed") {
            baseQuery.status = req.query.status;
        }

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

        // Priority level filter
        if (req.query.priorityLevel) {
            baseQuery['complaint.priorityLevel'] = req.query.priorityLevel;
        }

        // Complaint type filter
        if (req.query.complaintType) {
            baseQuery['complaint.complaintType'] = new RegExp(req.query.complaintType, 'i');
        }

        // Execute search with pagination
        const onCalls = await OnCall.find(baseQuery)
            .populate('customer', 'customername customercode')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(); // Use lean() for better performance

        // Get total count for pagination
        const total = await OnCall.countDocuments(baseQuery);
        const totalPages = Math.ceil(total / limit);

        // Calculate pagination info
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        // Prepare response
        const response = {
            success: true,
            data: onCalls,
            pagination: {
                currentPage: page,
                totalPages,
                totalRecords: total,
                recordsPerPage: limit,
                recordsOnPage: onCalls.length,
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
                    minDiscount: req.query.minDiscount || null,
                    maxDiscount: req.query.maxDiscount || null,
                    startDate: req.query.startDate || null,
                    endDate: req.query.endDate || null,
                    createdBy: req.query.createdBy || null,
                    priorityLevel: req.query.priorityLevel || null,
                    complaintType: req.query.complaintType || null
                }
            }
        };

        res.json(response);

    } catch (error) {
        console.error('OnCall search error:', error);
        res.status(500).json({
            success: false,
            message: 'Error occurred during search',
            error: error.message
        });
    }
});

router.get('/pagecallcompleted', async (req, res) => {
    try {
        const filters = { ...req.query };

        // Pagination parameters
        const page = parseInt(filters.page) || 1;
        const limit = parseInt(filters.limit) || 10;
        const skip = (page - 1) * limit;

        // Filtering logic
        const query = {};

        // Only fetch completed status
        query.status = "completed";

        if (filters.createdBy) {
            query.createdBy = filters.createdBy;
        }

        // Remove the status filter logic since we only want completed
        // The query.status is already set to "completed" above

        // Fetch data with pagination
        const onCalls = await OnCall.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalOnCalls = await OnCall.countDocuments(query);
        const totalPages = Math.ceil(totalOnCalls / limit);

        return res.json({
            success: true,
            message: `${onCalls.length} OnCall(s) fetched`,
            data: onCalls,
            totalPages,
            totalOnCalls,
            currentPage: page
        });
    } catch (err) {
        console.error('[OnCall] Fetch Error:', err.message);
        return res.status(500).json({
            message: 'Failed to fetch OnCalls',
            error: err.message
        });
    }
});
// Get OnCalls by customerId with optional filters
router.get('/customer/:customerId', async (req, res) => {
    try {
        const { customerId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const searchTerm = req.query.q || req.query.search || '';

        // Base query by customer customercodeid
        let baseQuery = {
            'customer.customercodeid': customerId
        };

        // Search functionality
        if (searchTerm.trim()) {
            const searchRegex = new RegExp(searchTerm.trim(), 'i');
            baseQuery = {
                ...baseQuery,
                $or: [
                    { onCallNumber: searchRegex },
                    { cnoteNumber: searchRegex },
                    { 'customer.customername': searchRegex },
                    { status: searchRegex },
                    { remark: searchRegex },
                    { 'complaint.notification_complaintid': searchRegex },
                    { 'complaint.complaintType': searchRegex },
                    { 'complaint.serialnumber': searchRegex },
                    { 'complaint.complaintDetails': searchRegex }
                ]
            };
        }

        // Optional status filter - only if passed
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

        // Query execution with pagination
        const onCalls = await OnCall.find(baseQuery)
            .populate('customer', 'customername customercode city email telephone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await OnCall.countDocuments(baseQuery);
        const totalPages = Math.ceil(total / limit);

        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        const customerInfo = onCalls.length > 0 ? onCalls[0].customer : null;

        if (!customerInfo && onCalls.length === 0) {
            const anyOnCall = await OnCall.findOne(
                { 'customer.customercodeid': customerId },
                { customer: 1 }
            ).lean();

            if (!anyOnCall) {
                return res.status(404).json({
                    success: false,
                    message: 'No OnCalls found for this customer',
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
            message: `Found ${total} OnCalls for customer ${customerId}`,
            data: onCalls,
            customer: customerInfo,
            pagination: {
                currentPage: page,
                totalPages,
                totalRecords: total,
                recordsPerPage: limit,
                recordsOnPage: onCalls.length,
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
        console.error('Error fetching OnCalls by customer:', error);
        res.status(500).json({
            success: false,
            message: 'Error occurred while fetching OnCalls',
            error: error.message,
            data: [],
            customer: null
        });
    }
});

// Get OnCalls by customerId excluding those with onCallproposalstatus = "Open"
router.get('/customercmcclose/:customerId', async (req, res) => {
    try {
        const { customerId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const searchTerm = req.query.q || req.query.search || '';

        // Base query excludes onCallproposalstatus: "Open"
        let baseQuery = {
            'customer.customercodeid': customerId,
            onCallproposalstatus: { $ne: "Open" }
        };

        // Search functionality
        if (searchTerm.trim()) {
            const searchRegex = new RegExp(searchTerm.trim(), 'i');
            baseQuery = {
                ...baseQuery,
                $or: [
                    { onCallNumber: searchRegex },
                    { cnoteNumber: searchRegex },
                    { 'customer.customername': searchRegex },
                    { status: searchRegex },
                    { remark: searchRegex },
                    { 'complaint.notification_complaintid': searchRegex },
                    { 'complaint.complaintType': searchRegex },
                    { 'complaint.serialnumber': searchRegex },
                    { 'complaint.complaintDetails': searchRegex }
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

        // Query execution with pagination
        const onCalls = await OnCall.find(baseQuery)
            .populate('customer', 'customername customercode city email telephone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await OnCall.countDocuments(baseQuery);
        const totalPages = Math.ceil(total / limit);

        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        const customerInfo = onCalls.length > 0 ? onCalls[0].customer : null;

        res.json({
            success: true,
            message: `Found ${total} OnCalls (excluding Open) for customer ${customerId}`,
            data: onCalls,
            customer: customerInfo,
            pagination: {
                currentPage: page,
                totalPages,
                totalRecords: total,
                recordsPerPage: limit,
                recordsOnPage: onCalls.length,
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
        console.error('Error fetching OnCalls (excluding Open):', error);
        res.status(500).json({
            success: false,
            message: 'Error occurred while fetching OnCalls',
            error: error.message,
            data: [],
            customer: null
        });
    }
});

router.get('/', async (req, res) => {
    try {
        const filters = { ...req.query };

        // Optional filtering logic, e.g. by createdBy or status
        const query = {};

        if (filters.createdBy) {
            query.createdBy = filters.createdBy;
        }

        if (filters.status) {
            query.status = filters.status;
        }

        const onCalls = await OnCall.find(query).sort({ createdAt: -1 });

        return res.json({
            success: true,
            message: `${onCalls.length} OnCall(s) fetched`,
            data: onCalls
        });
    } catch (err) {
        console.error('[OnCall] Fetch Error:', err.message);
        return errorResponse(res, 500, 'Failed to fetch OnCalls', {
            errorType: err.name
        });
    }
});

// Route: Create OnCall
router.post('/', validateOnCallRequest, async (req, res) => {
    try {
        const onCallData = {
            ...req.body,
            RSHApproval: req.body.RSHApproval || { approved: false },
            NSHApproval: req.body.NSHApproval || { approved: false }
        };

        const onCall = new OnCall(onCallData);
        await onCall.save();

        return res.status(201).json({
            success: true,
            message: 'OnCall created successfully',
            data: onCall,
            resourceId: onCall._id
        });
    } catch (err) {
        console.error('[OnCall] Creation Error:', err.message);

        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(val => ({
                field: val.path,
                message: val.message,
                value: val.value
            }));

            return errorResponse(res, 400, 'Validation failed', {
                validationErrors: errors
            });
        }

        return errorResponse(res, 500, 'Failed to create OnCall', {
            errorType: err.name
        });
    }
});

router.put('/:id/revision', async (req, res) => {
    try {
        const oncall = await OnCall.findById(req.params.id);
        if (!oncall) {
            return res.status(404).json({ message: 'OnCall not found' });
        }

        // main fields aapne front se bheje hain
        const {
            discountPercentage,
            discountAmount,
            afterDiscount,
            tdsAmount,
            afterTds,
            gstAmount,
            finalAmount,
            pricingMode,
            remark,
            additionalServiceCharge // OPTIONAL from frontend if exists
        } = req.body;

        // new revisionNumber
        const newRevisionNumber = (oncall.currentRevision || 0) + 1;

        // revisionData for revision history
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
                remark: remark || `OnCall revised, Revision ${newRevisionNumber}`,
                pricingMode
            }
        };

        // Reset approvals RSH/NSH
        const resetApproval = { approved: false, approvedBy: null, approvedAt: null };
        oncall.RSHApproval = { ...resetApproval };
        oncall.NSHApproval = { ...resetApproval };

        // update summary fields
        oncall.discountPercentage = discountPercentage;
        oncall.discountAmount = discountAmount;
        oncall.afterDiscount = afterDiscount;
        oncall.tdsAmount = tdsAmount;
        oncall.afterTds = afterTds;
        oncall.gstAmount = gstAmount;
        oncall.finalAmount = finalAmount;
        oncall.status = 'revised';
        oncall.remark = remark || `OnCall revised, Revision ${newRevisionNumber}`;
        oncall.currentRevision = newRevisionNumber;
        oncall.updatedAt = new Date();

        // optional additionalServiceCharge
        if (additionalServiceCharge) {
            oncall.additionalServiceCharge = additionalServiceCharge;
        }

        // status history update
        oncall.statusHistory = [
            ...(oncall.statusHistory || []),
            {
                status: 'revised',
                changedAt: new Date(),
            }
        ];

        // Push to revisions array
        oncall.revisions.push(revisionData);

        await oncall.save();

        // You can send Email notification here if required

        res.json({
            message: `OnCall revised successfully.`,
            updatedOnCall: oncall
        });

    } catch (err) {
        console.error("OnCall revision error:", err);
        res.status(500).json({ message: 'Failed to process revision', error: err.message });
    }
});
// Approve by RSH (OnCall)
router.put('/:id/approve-rsh', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });

        const oncall = await OnCall.findById(req.params.id);
        if (!oncall) return res.status(404).json({ success: false, message: 'OnCall not found' });

        // Mark RSHApproval
        oncall.RSHApproval = {
            approved: true,
            approvedBy: userId,
            approvedAt: new Date(),
        };

        // Current revision audit
        const rev = oncall.revisions.find(
            (r) => r.revisionNumber === oncall.currentRevision
        );
        if (rev) {
            rev.approvalHistory = rev.approvalHistory || [];
            rev.approvalHistory.push({
                status: 'approved',
                changedAt: new Date(),
                changedBy: userId,
                approvalType: 'RSH',
            });

            // Should revision status become approved?
            const needNSH = (oncall.discountPercentage || 0) > 10;
            if (!needNSH) {
                rev.status = 'approved';
                oncall.status = 'approved';
            } else if (oncall.NSHApproval?.approved) {
                rev.status = 'approved';
                oncall.status = 'approved';
            }
        }

        await oncall.save();
        res.json({ success: true, data: oncall });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error during approval', error: error.message });
    }
});

// Approve by NSH (OnCall)
router.put('/:id/approve-nsh', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });

        const oncall = await OnCall.findById(req.params.id);
        if (!oncall) return res.status(404).json({ success: false, message: 'OnCall not found' });

        // Mark NSHApproval
        oncall.NSHApproval = {
            approved: true,
            approvedBy: userId,
            approvedAt: new Date(),
        };

        // Current revision audit
        const rev = oncall.revisions.find(
            (r) => r.revisionNumber === oncall.currentRevision
        );
        if (rev) {
            rev.approvalHistory = rev.approvalHistory || [];
            rev.approvalHistory.push({
                status: 'approved',
                changedAt: new Date(),
                changedBy: userId,
                approvalType: 'NSH',
            });

            // For >10% discount, both must be approved to finish revision
            const needNSH = (oncall.discountPercentage || 0) > 10;
            if (!needNSH) {
                if (oncall.RSHApproval?.approved) {
                    rev.status = 'approved';
                    oncall.status = 'approved';
                }
            } else if (oncall.RSHApproval?.approved) {
                rev.status = 'approved';
                oncall.status = 'approved';
            }
        }
        await oncall.save();
        res.json({ success: true, data: oncall });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error during approval', error: error.message });
    }
});
// Reject current revision (OnCall)
router.put('/:id/reject-revision', async (req, res) => {
    try {
        const { userId, reason, approvalType } = req.body;
        if (!userId || !reason || !approvalType)
            return res.status(400).json({
                success: false,
                message: 'User ID, rejection reason, and approvalType are required'
            });

        const oncall = await OnCall.findById(req.params.id);
        if (!oncall) return res.status(404).json({ success: false, message: 'OnCall not found' });

        // Current revision
        const rev = oncall.revisions.find(
            (r) => r.revisionNumber === oncall.currentRevision
        );
        if (!rev)
            return res.status(404).json({
                success: false,
                message: 'Current revision not found'
            });

        rev.approvalHistory = rev.approvalHistory || [];
        rev.approvalHistory.push({
            approvalType: approvalType,
            status: 'rejected',
            changedAt: new Date(),
            changedBy: userId,
            remark: reason
        });

        // Set approval status (oncall.RSHApproval or NSHApproval)
        if (approvalType === "RSH") {
            oncall.RSHApproval = {
                approved: false,
                rejected: true,
                approvedBy: userId,
                approvedAt: new Date(),
                rejectReason: reason,
            };
        } else if (approvalType === "NSH") {
            oncall.NSHApproval = {
                approved: false,
                rejected: true,
                approvedBy: userId,
                approvedAt: new Date(),
                rejectReason: reason,
            };
        }

        // Set revision and oncall status as rejected
        rev.status = 'rejected';
        oncall.status = 'rejected';
        oncall.updatedAt = new Date();

        await oncall.save();
        res.json({ success: true, data: oncall });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error during rejection',
            error: error.message
        });
    }
});

// Get a specific revision (OnCall)
router.get('/:id/revisions/:revisionNumber', async (req, res) => {
    try {
        const oncall = await OnCall.findOne({
            _id: req.params.id,
            'revisions.revisionNumber': parseInt(req.params.revisionNumber)
        }, {
            'revisions.$': 1
        });

        if (!oncall || !oncall.revisions || oncall.revisions.length === 0) {
            return res.status(404).json({ message: 'Revision not found' });
        }

        res.json(oncall.revisions[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update OnCall
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check for valid MongoDB ObjectId
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return errorResponse(res, 400, 'Invalid ID format', {
                received: id
            });
        }

        const updateData = {
            ...req.body,
            modifiedAt: new Date()
        };

        const updatedOnCall = await OnCall.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true
        });

        if (!updatedOnCall) {
            return errorResponse(res, 404, 'OnCall not found', {
                resourceId: id
            });
        }

        return res.json({
            success: true,
            message: 'OnCall updated successfully',
            data: updatedOnCall
        });
    } catch (err) {
        console.error('[OnCall] Update Error:', err.message);

        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(val => ({
                field: val.path,
                message: val.message,
                value: val.value
            }));

            return errorResponse(res, 400, 'Validation failed', {
                validationErrors: errors
            });
        }

        return errorResponse(res, 500, 'Failed to update OnCall', {
            errorType: err.name
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const proposal = await OnCall.findById(req.params.id);
        if (!proposal) {
            return res.status(404).json({ message: 'Proposal not found' });
        }
        res.json(proposal);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// OnCall के लिए CO Number update API
router.put('/:id/update-conumber', async (req, res) => {
    try {
        const { CoNumber } = req.body;

        if (!CoNumber) {
            return res.status(400).json({
                success: false,
                message: 'CoNumber is required'
            });
        }

        const onCall = await OnCall.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    CoNumber,
                    status: 'completed',
                    onCallproposalstatus: 'CLOSED_WON',   // <-- added
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

        if (!onCall) {
            return res.status(404).json({
                success: false,
                message: 'OnCall not found'
            });
        }

        res.json({
            success: true,
            message: 'CoNumber updated, status set to completed, proposal closed won',
            data: onCall
        });
    } catch (error) {
        console.error('OnCall update error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during OnCall update',
            error: error.message
        });
    }
});


router.get('/by-complaint/:complaintId', async (req, res) => {
    try {
        const { complaintId } = req.params

        if (!complaintId) {
            return res.status(400).json({
                success: false,
                message: 'Complaint ID is required'
            })
        }

        // Find OnCall document by complaint notification_complaintid
        const onCall = await OnCall.findOne({
            'complaint.notification_complaintid': complaintId
        }).lean()

        if (!onCall) {
            return res.status(404).json({
                success: false,
                message: `No OnCall found for complaint ID: ${complaintId}`
            })
        }

        // Return the status and other details
        return res.json({
            success: true,
            data: {
                status: onCall.status,
            }
        })

    } catch (error) {
        console.error('Error fetching OnCall:', error)
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        })
    }
})

router.get('/check-by-complaint/:complaintId', async (req, res) => {
    try {
        const { complaintId } = req.params;

        // Validation
        if (!complaintId) {
            return res.status(400).json({
                success: false,
                exists: false
            });
        }

        // Database में search करें
        const existingOnCall = await OnCall.findOne({
            'complaint.notification_complaintid': complaintId
        });

        // Simple true/false response
        return res.status(200).json({
            success: true,
            exists: existingOnCall ? true : false
        });

    } catch (error) {
        console.error('Error checking OnCall by complaint ID:', error);
        return res.status(500).json({
            success: false,
            exists: false
        });
    }
});
// Now keep /:id at the END
router.get('/:id', async (req, res) => {
    // your single oncall fetch logic
});


// Delete OnCall
router.delete('/:id', async (req, res) => {
    try {
        if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            return errorResponse(res, 400, 'Invalid ID format', {
                received: req.params.id
            });
        }

        const onCall = await OnCall.findByIdAndDelete(req.params.id);
        if (!onCall) {
            return errorResponse(res, 404, 'OnCall not found', {
                resourceId: req.params.id
            });
        }

        res.json({
            success: true,
            message: 'OnCall deleted successfully',
            deletedResource: {
                id: onCall._id,
                customerName: onCall.customer?.customername,
                complaintId: onCall.complaintDetails?.notification_complaintid,
                createdAt: onCall.createdAt
            }
        });
    } catch (err) {
        console.error('[OnCall] Delete Error:', {
            error: err.message,
            id: req.params.id
        });

        errorResponse(res, 500, 'Failed to delete OnCall', {
            resourceId: req.params.id,
            errorType: err.name,
            ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
        });
    }
});


module.exports = router;

