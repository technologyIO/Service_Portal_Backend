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


router.post('/', validateOnCallRequest, async (req, res) => {
    try {
        const onCallData = {
            ...req.body,
            complaint: req.body.complaintDetails // map correctly
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
        console.error('[OnCall Creation Error]', err);

        return errorResponse(res, 500, 'Failed to create OnCall', {
            errorType: err.name,
            message: err.message
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