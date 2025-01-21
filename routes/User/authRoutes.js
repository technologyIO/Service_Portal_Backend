const express = require('express');
const { registerUser, loginUser } = require('./adminUser');
 

const router = express.Router();

// Register Route
router.post('/adminregister', registerUser);

// Login Route
router.post('/adminlogin', loginUser);



module.exports = router;
