const User = require('../../Model/UserSchema/UserSchema');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'my_name_is_shivam';

const generateToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, {
        expiresIn: '30d',
    });
};

const registerUser = async (req, res) => {
    const { employeeId, email, password } = req.body;

    try {
        const userExists = await User.findOne({ employeeId });

        if (userExists) {
            return res.status(400).json({ message: 'Employee ID already exists' });
        }

        const user = await User.create({
            employeeId,
            email,
            password,
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                employeeId: user.employeeId,
                email: user.email,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const loginUser = async (req, res) => {
    const { employeeId, password } = req.body;

    try {
        const user = await User.findOne({ employeeId });

        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                employeeId: user.employeeId,
                email: user.email,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid employee ID or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { registerUser, loginUser };
