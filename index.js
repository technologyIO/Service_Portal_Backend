const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const Country = require('./routes/Collections/Country');
const State = require('./routes/Collections/State');
const City = require('./routes/Collections/City');
const Branch = require('./routes/Collections/Branch');
const Role = require('./routes/Collections/roles');
const UserType = require('./routes/Collections/UserType');
const DepartMent = require('./routes/Collections/Department');
const ProductGroup = require('./routes/Collections/ProductGroup');
const CheckList = require('./routes/Collections/CheckList');
const PmMaster = require('./routes/Collections/PmMaster');
const User = require('./routes/Master/User');
const Dealer = require('./routes/Master/Dealer');
const Equipment = require('./routes/Master/Equipment');
const Product = require('./routes/Master/Product');
const ReportedProblemSchema = require('./routes/Master/ReportedProblem');
const WarrantyCode = require('./routes/Master/WarrantyCode');
const ReplacedPartCode = require('./routes/Master/ReplacedPartCode');
const Aerb = require('./routes/Master/Aerb');
const Customer = require('./routes/Upload/Customer');
const Amccontracts = require('./routes/Upload/AMCContract');
const DealerStock = require('./routes/Upload/DealerStock');
const overlayRoutes = require('./routes/Upload/overlays');
const Hubstocks = require('./routes/Upload/HubStock');
const Pendinginstallations = require('./routes/Upload/PendingInstallation');
const Pendingcomplaints = require('./routes/Upload/PendingCompliants');
const authRoutes = require('./routes/User/authRoutes')
const cors = require('cors');
const app = express();
app.use(cors());
// Middleware
app.use(bodyParser.json());
app.use(express.json({ limit: '50mb' })); // Increase JSON body parser limit
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Increase URL-encoded body parser limit

// MongoDB connection
mongoose.connect('mongodb+srv://shivamt2023:ft123shivam123@cluster0.qcx5f1c.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true, // Remove deprecated option
  useUnifiedTopology: true, // Remove deprecated option
  // dbName: 'Service-Portal' // Add your actual database name here
})
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err);
  });

// Import routes
app.use('/api/overlays', overlayRoutes);
app.use('/api/auth', authRoutes);
app.use('/collections', Country);
app.use('/collections', State);
app.use('/collections', City);
app.use('/collections', Branch);
app.use('/collections', Role);
app.use('/collections', UserType);
app.use('/collections', DepartMent);
app.use('/collections', ProductGroup);
app.use('/collections', CheckList);
app.use('/collections', PmMaster);
app.use('/collections', User);
app.use('/collections', Dealer);
app.use('/collections', Equipment);
app.use('/collections', Product);
app.use('/collections', ReportedProblemSchema);
app.use('/collections', WarrantyCode);
app.use('/collections', ReplacedPartCode);
app.use('/collections', Aerb);
app.use('/collections', Customer);
app.use('/collections', Amccontracts);
app.use('/collections', DealerStock);
app.use('/collections', Hubstocks);
app.use('/collections', Pendinginstallations);
app.use('/collections', Pendingcomplaints);

// Routes
app.get('/', (req, res) => {
  res.send('Hello World!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
