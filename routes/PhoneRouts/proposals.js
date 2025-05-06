const express = require('express');
const router = express.Router();
const Proposal = require('../../Model/AppSchema/proposalSchema');

// Create a new proposal
router.post('/', async (req, res) => {
    try {
        const proposalData = req.body;
        const proposal = new Proposal(proposalData);
        await proposal.save();
        res.status(201).json(proposal);
    } catch (error) {
        res.status(400).json({ message: error.message });
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

        // Calculate new amounts
        const grandSubTotal = proposal.grandSubTotal;
        const discountAmount = grandSubTotal * (discountPercentage / 100);
        const afterDiscount = grandSubTotal - discountAmount;
        const tdsAmount = afterDiscount * (proposal.tdsPercentage / 100);
        const afterTds = afterDiscount - tdsAmount;
        const gstAmount = afterTds * (proposal.gstPercentage / 100);
        const finalAmount = afterTds + gstAmount;

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
                remark: req.body.remark || `Revision ${newRevisionNumber}`
            }
        };

        // Update main proposal with new values
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
                    remark: req.body.remark,
                    status: 'revised',
                    currentRevision: newRevisionNumber,
                    updatedAt: Date.now()
                },
                $push: { revisions: revisionData }
            },
            { new: true }
        );

        res.status(200).json(updatedProposal);
    } catch (error) {
        res.status(400).json({ message: error.message });
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
router.put('/:id/approve-rsh', async (req, res) => {
    try {
        console.log('Approval request received:', req.body);
        
        const { userId, itemId } = req.body;

        if (!userId) {
            console.log('User ID missing in request');
            return res.status(400).json({ 
                success: false,
                message: 'User ID is required' 
            });
        }

        const proposal = await Proposal.findById(req.params.id);
        if (!proposal) {
            console.log('Proposal not found:', req.params.id);
            return res.status(404).json({ 
                success: false,
                message: 'Proposal not found' 
            });
        }

        // If itemId is provided, update specific item
        if (itemId) {
            const item = proposal.items.id(itemId);
            if (!item) {
                console.log('Item not found:', itemId);
                return res.status(404).json({ 
                    success: false,
                    message: 'Item not found' 
                });
            }
            
            item.RSHApproval = {
                approved: true,
                approvedBy: userId,
                approvedAt: new Date()
            };
        } else {
            // Update all items
            proposal.items.forEach(item => {
                item.RSHApproval = {
                    approved: true,
                    approvedBy: userId,
                    approvedAt: new Date()
                };
            });
        }

        proposal.updatedAt = new Date();
        await proposal.save();

        console.log('Approval successful for proposal:', proposal._id);
        res.json({
            success: true,
            data: proposal
        });
    } catch (error) {
        console.error('Approval error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error during approval',
            error: error.message 
        });
    }
});

// Approve by NSH (updated version)
router.put('/:id/approve-nsh', async (req, res) => {
    try {
        console.log('Approval request received:', req.body);
        
        const { userId, itemId } = req.body;

        if (!userId) {
            console.log('User ID missing in request');
            return res.status(400).json({ 
                success: false,
                message: 'User ID is required' 
            });
        }

        const proposal = await Proposal.findById(req.params.id);
        if (!proposal) {
            console.log('Proposal not found:', req.params.id);
            return res.status(404).json({ 
                success: false,
                message: 'Proposal not found' 
            });
        }

        // If itemId is provided, update specific item
        if (itemId) {
            const item = proposal.items.id(itemId);
            if (!item) {
                console.log('Item not found:', itemId);
                return res.status(404).json({ 
                    success: false,
                    message: 'Item not found' 
                });
            }
            
            item.NSHApproval = {
                approved: true,
                approvedBy: userId,
                approvedAt: new Date()
            };
        } else {
            // Update all items
            proposal.items.forEach(item => {
                item.NSHApproval = {
                    approved: true,
                    approvedBy: userId,
                    approvedAt: new Date()
                };
            });
        }

        proposal.updatedAt = new Date();
        await proposal.save();

        console.log('Approval successful for proposal:', proposal._id);
        res.json({
            success: true,
            data: proposal
        });
    } catch (error) {
        console.error('Approval error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error during approval',
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

// Get proposals by customer
router.get('/customer/:customerId', async (req, res) => {
    try {
        const proposals = await Proposal.find({ 'customer.customercodeid': req.params.customerId })
            .sort({ createdAt: -1 });
        res.json(proposals);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;