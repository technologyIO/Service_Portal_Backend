const express = require('express');
const { registerUser, loginUser } = require('./User');
// const jwt = require('jsonwebtoken');
// const User = require('../../Model/UserSchema/UserSchema');

const router = express.Router();

// Register Route
router.post('/register', registerUser);

// Login Route
router.post('/login', loginUser);



module.exports = router;
