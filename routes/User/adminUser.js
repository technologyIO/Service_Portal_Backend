const AdminUser = require('../../Model/UserSchema/UseradminSchema');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'my_name_is_shivam';

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: '30d',
  });
};

const registerUser = async (req, res) => {
  const { name, employeeId, email, password, roleName, roleNumber } = req.body;

  try {
    const userExists = await AdminUser.findOne({
      $or: [{ employeeId }, { email }],
    });

    if (userExists) {
      return res.status(400).json({ message: 'Employee ID or Email already exists' });
    }

    const user = await AdminUser.create({
      name,
      employeeId,
      email,
      password,
      roleName,
      roleNumber,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      employeeId: user.employeeId,
      email: user.email,
      roleName: user.roleName,
      roleNumber: user.roleNumber,
      token: generateToken(user._id),
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      console.error('Validation Error:', error.message);
      return res.status(400).json({ message: 'Invalid role or role number' });
    }
    res.status(500).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  const { employeeId, email, password } = req.body;

  try {
    const user = await AdminUser.findOne({
      $or: [{ employeeId }, { email }],
    });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        employeeId: user.employeeId,
        email: user.email,
        roleName: user.roleName,
        roleNumber: user.roleNumber,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials (ID/Email or Password)' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { registerUser, loginUser };
