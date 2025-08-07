const express = require('express');
const router = express.Router();
const State = require('../../Model/CollectionSchema/StateSchema');

// Middleware function to get a state by ID
async function getState(req, res, next) {
    try {
        const state = await State.findById(req.params.id);
        if (!state) {
            return res.status(404).json({ message: 'State not found' });
        }
        res.state = state; // Attach state object to response
        next();
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

// Middleware function to check duplicate state by name and country

const checkDuplicateState = async (req, res, next) => {
    const existing = await State.findOne({ name: req.body.name });
    if (existing) {
        return res.status(409).json({
            status: 409,
            message: 'State name already exists'
        });
    }
    next();
};

// Create a new state
router.post('/state', checkDuplicateState, async (req, res) => {
    try {
        const newState = new State(req.body);
        const savedState = await newState.save();

        res.status(201).json({
            status: 201,
            message: 'State created successfully',
            data: savedState
        });
    } catch (err) {
        // MongoDB duplicate key error (in case middleware missed it)
        if (err.code === 11000) {
            return res.status(409).json({
                status: 409,
                message: 'State name already exists'
            });
        }

        res.status(400).json({
            status: 400,
            message: 'Error creating state',
            error: err.message
        });
    }
});

router.get('/allstate', async (req, res) => {
    try {
        const state = await State.find();
        res.json(state);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get all states
router.get('/state', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Current page number, defaulting to 1
        const limit = parseInt(req.query.limit) || 10; // Number of documents per page, defaulting to 10

        const skip = (page - 1) * limit; // Calculate the number of documents to skip

        const states = await State.find().skip(skip).limit(limit); // Fetch states for the current page
        const totalStates = await State.countDocuments(); // Total number of states

        const totalPages = Math.ceil(totalStates / limit); // Calculate total number of pages

        res.json({
            states,
            totalPages,
            totalStates
        });
    } catch (err) {
        res.status(500).json({ message: err.message }); // Handle error and return JSON response with status 500 (Internal Server Error)
    }
});
router.get('/allstate', async (req, res) => {
    try {

        const states = await State.find(); // Fetch states for the current page

        res.json({
            states
        });
    } catch (err) {
        res.status(500).json({ message: err.message }); // Handle error and return JSON response with status 500 (Internal Server Error)
    }
});

// Get a single state
router.get('/state/:id', getState, (req, res) => {
    res.json(res.state); // Return single state fetched by middleware
});

// Update a state
router.patch('/state/:id', getState, async (req, res) => {
    if (req.body.name != null) {
        res.state.name = req.body.name;
    }
    if (req.body.status != null) {
        res.state.status = req.body.status;
    }
    if (req.body.stateId != null) {
        res.state.stateId = req.body.stateId;
    }
    if (req.body.country != null) {
        res.state.country = req.body.country;
    }

    res.state.modifiedAt = Date.now(); // Update modifiedAt field

    try {
        const updatedState = await res.state.save();
        res.status(200).json({
            status: 200,
            message: 'State updated successfully',
            data: updatedState
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                status: 409,
                message: 'State name already exists'
            });
        }

        res.status(400).json({
            status: 400,
            message: 'Error updating state',
            error: err.message
        });
    }
});




// Delete a state
router.delete('/state/:id', async (req, res) => {
    try {
        const deletedState = await State.deleteOne({ _id: req.params.id });
        if (deletedState.deletedCount === 0) {
            return res.status(404).json({ message: 'State not found' });
        }
        res.json({ message: 'Deleted State' }); // Return success message
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/searchState', async (req, res) => {
    try {
        const { q } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        if (!q) {
            return res.status(400).json({ message: 'Query parameter is required' });
        }

        const query = {
            $or: [
                { name: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } },
                { region: { $regex: q, $options: 'i' } },
                { stateId: { $regex: q, $options: 'i' } }
            ]
        };

        const states = await State.find(query).skip(skip).limit(limit);
        const totalStates = await State.countDocuments(query);
        const totalPages = Math.ceil(totalStates / limit);

        res.json({
            states,
            totalPages,
            totalStates,
            currentPage: page,
            isSearch: true
        });
    } catch (err) {
        res.status(500).json({
            message: err.message,
            states: [],
            totalPages: 1,
            totalStates: 0,
            currentPage: 1
        });
    }
});


module.exports = router;
