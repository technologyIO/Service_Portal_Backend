const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const Country = require('./routes/Collections/Country');
const State = require('./routes/Collections/State');
const City = require('./routes/Collections/City');
const Branch = require('./routes/Collections/Branch');
// const Role = require('./routes/Collections/roles');
const UserType = require('./routes/Collections/UserType');
const DepartMent = require('./routes/Collections/Department');
const ProductGroup = require('./routes/Collections/ProductGroup');
const CheckList = require('./routes/Collections/CheckList');
const PmMaster = require('./routes/Collections/PmMaster');
const CheckListType = require('./routes/Collections/CheckListType');
const CheckPointType = require('./routes/Collections/CheckPointType');
const User = require('./routes/Master/User');
const Dealer = require('./routes/Master/Dealer');
const Equipment = require('./routes/Master/Equipment');
const formatMasterRoutes = require('./routes/Master/formatMaster');
const installationChecklistRoutes = require('./routes/Master/InstallationChecklist');
const SpareMaster = require('./routes/Master/SpareMaster');
const equipmentChecklistRoutes = require('./routes/Collections/EquipmentChecklist');
const Geo = require('./routes/Admin/geo');
const pmDocMasterRoutes = require('./routes/Master/pmDocMaster');
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
const compression = require('compression');
const installationRoutes = require('./routes/PhoneRouts/EquipmentInstallation')
const cors = require('cors');
const ComplaintType = require('./routes/Complaints/ComplaintType');
const ProblemType = require('./routes/Complaints/ProblemType');
const ProblemName = require('./routes/Complaints/ProblemName');
const PreventiveMaintenance = require('./routes/Upload/PreventiveMaintenance');
const EquipmentBulk = require('./BulkUpload/Master/EquipmentBulk');
const AerbBulk = require('./BulkUpload/Master/AerbBulk');
const ProductBulk = require('./BulkUpload/Master/ProductBulk');
const ChecklistBulk = require('./BulkUpload/Master/CheckListBulk');
const AmcContractBulk = require('./BulkUpload/Upload/AmcContractBulk');
const notificationRoutes = require('./routes/Admin/NotificationSettings');
const DealerStockBulk = require('./BulkUpload/Upload/DealerStockBulk');
const pendingInstallationBulk = require('./BulkUpload/Upload/PendingInstallationBulk');
const HubStockBulk = require('./BulkUpload/Upload/HubStockBulk');
const PendingComplaintsBulk = require('./BulkUpload/Upload/PendingComplaintsBulk');
const SpareMasterBulk = require('./BulkUpload/Master/SpareMasterBulk');
const ContractProposal = require('./routes/Upload/ContractProposal');
const CmcNcmcYears = require('./routes/Admin/CmcNcmcYears');
const CmcNcmcPrice = require('./routes/Admin/cmcNcmcPriceRoutes');
const CmcNcmcTds = require('./routes/Admin/CmcNcmcTds');
const ServiceChargeRoutes = require('./routes/Admin/ServiceCharge');
const Region = require('./routes/Admin/region');
const gstRoutes = require('./routes/Admin/GstRoutes');
const OnCallRoutes = require('./routes/PhoneRouts/oncall');
const discountRoutes = require('./routes/Admin/DiscountRoutes');
const proposalRoutes = require('./routes/PhoneRouts/proposals');
const CNoteRoutes = require('./routes/PhoneRouts/cnoteController');
const onCallCNoteRouts = require('./routes/PhoneRouts/onCallCNote');
const componentRoutes = require('./routes/Role/componentRoutes');
const roleRoutes = require('./routes/Role/roleRoutes');
const reportRoutes = require('./routes/Role/reportRoutes');
const CustomerBulk = require('./BulkUpload/Upload/CustomerBulk');
const replacedPartCodeUpload = require('./BulkUpload/Master/ReplacePartCodeBulk');
const WarrantyCodeBulk = require('./BulkUpload/Master/WarrantyCodeBulk');
const ReportedProblemBulk = require('./BulkUpload/Master/ReportedProblemBulk');
const mobilecomponentRoutes = require('./routes/Role/MobileComponent');
const userExcelRoutes = require('./routes/Master/ExcelDownload/UserExcel');
const aerbExcelRoutes = require('./routes/Master/ExcelDownload/AerbExcel');
const dealerExcelRoutes = require('./routes/Master/ExcelDownload/DealerExcel');
const branchExcelRoutes = require('./routes/Master/ExcelDownload/BranchExcel');
const productExcelRoutes = require('./routes/Master/ExcelDownload/ProductExcel');
const checklistExcelRoutes = require('./routes/Master/ExcelDownload/CheckListExcel');
const equipmentExcelRoutes = require('./routes/Master/ExcelDownload/EquipmentExcel');
const complaintTypeExcelRoutes = require('./routes/Master/ExcelDownload/ComplaintTypeExcel');
const spareMasterExcelRoutes = require('./routes/Master/ExcelDownload/SpareMasterExcel');
const pmDocMasterExcelRoutes = require('./routes/Master/ExcelDownload/PMDocMasterExcel');
const formatMasterExcelRoutes = require('./routes/Master/ExcelDownload/FormatMasterExcel');
const warrantyCodeExcelRoutes = require('./routes/Master/ExcelDownload/WarrantyCodeExcel');
const reportedProblemExcelRoutes = require('./routes/Master/ExcelDownload/ReportedProblemExcel');
const replacedPartCodeExcelRoutes = require('./routes/Master/ExcelDownload/ReplacedPartCodeExcel');
const pmExcelRoutes = require('./routes/Master/ExcelDownload/PMExcel');
const customerExcelRoutes = require('./routes/Upload/ExcelDownload/CustomerExcel');
const hubStockExcelRoutes = require('./routes/Upload/ExcelDownload/HubStockExcel');
const dealerStockExcelRoutes = require('./routes/Upload/ExcelDownload/DealerStockExcel');
const amcContractExcelRoutes = require('./routes/Upload/ExcelDownload/AMCContractExcel');
const pendingComplaintsExcelRoutes = require('./routes/Upload/ExcelDownload/PendingComplaintsExcel');
const pendingInstallationExcelRoutes = require('./routes/Upload/ExcelDownload/PendingInstallationExcel');
const geoExcelRoutes = require('./routes/Admin/ExcelDownload/GeoExcel');
const countryExcelRoutes = require('./routes/Admin/ExcelDownload/CountryExcel');
const regionExcelRoutes = require('./routes/Admin/ExcelDownload/RegionExcel');
const stateExcelRoutes = require('./routes/Admin/ExcelDownload/StateExcel');
const cityExcelRoutes = require('./routes/Admin/ExcelDownload/CityExcel');
const departmentExcelRoutes = require('./routes/Admin/ExcelDownload/DepartmentExcel');
const productGroupExcelRoutes = require('./routes/Admin/ExcelDownload/ProductGroupExcel');
const checklistTypeExcelRoutes = require('./routes/Admin/ExcelDownload/CheckListTypeExcel');
const checkpointTypeExcelRoutes = require('./routes/Admin/ExcelDownload/CheckPointTypeExcel');
const cmcNcmcYearExcelRoutes = require('./routes/Admin/ExcelDownload/CmcNcmcYearExcel');
const cmcNcmcPriceExcelRoutes = require('./routes/Admin/ExcelDownload/CmcNcmcPriceExcel');
const cmcNcmcTdsExcelRoutes = require('./routes/Admin/ExcelDownload/CmcNcmcTdsExcel');
const gstExcelRoutes = require('./routes/Admin/ExcelDownload/GstExcelExport');
const discountExcelRoutes = require('./routes/Admin/ExcelDownload/DiscountExcel');
const serviceChargeExcelRoutes = require('./routes/Admin/ExcelDownload/ServiceChargeExcel');
const CmcNcmcPriceBulk = require('././BulkUpload/Admin/CmcNcmcPriceBulk');

const path = require('path');
const fs = require('fs');



require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "https://serviceapp-eight.vercel.app",
      "https://service-portal-admin.vercel.app",
      "https://servicep.insideoutprojects.in",
      "https://serviceportal.shvx.dev",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://localhost",
      "http://127.0.0.1",
      "capacitor://localhost",
      "https://localhost",
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      // console.log("✅ Allowed Origin:", origin);
      callback(null, true);
    } else {
      console.error("❌ CORS Blocked Origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};



const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory at:', uploadsDir);
}

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir));
console.log(`Serving static files from: ${uploadsDir}`);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err);
  });


// Import routes
app.use('/api/overlays', overlayRoutes);
app.use('/collections', Country);
app.use('/collections', State);
app.use('/collections', City);
app.use('/collections', Geo);
app.use('/collections', Region);
app.use('/collections', Branch);
// app.use('/collections', Role);
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
app.use('/collections', SpareMaster);
app.use('/collections', CheckListType);
app.use('/collections', CheckPointType);
app.use('/installations', installationRoutes)
app.use('/complaints', ComplaintType)
app.use('/complaints', ProblemType)
app.use('/master', formatMasterRoutes)
app.use('/role/components', componentRoutes);
app.use('/role/mobilecomponents', mobilecomponentRoutes);
app.use('/role', reportRoutes);
app.use('/roles', roleRoutes);
app.use("/complaints/installationschecklist", installationChecklistRoutes);
app.use('/complaints', ProblemName)
app.use('/upload', PreventiveMaintenance)
app.use('/collections/checklistsave', equipmentChecklistRoutes);
app.use('/upload/contract', ContractProposal);
app.use('/admin/cmcncmcyear', CmcNcmcYears);
app.use('/admin/cmcncmcprice', CmcNcmcPrice);
app.use('/admin/cmc-ncmc-tds', CmcNcmcTds);
app.use('/admin/gst', gstRoutes);
app.use('/admin/discount', discountRoutes);
app.use('/admin/service-charge', ServiceChargeRoutes);
app.use('/phone/proposal', proposalRoutes);
app.use('/phone/cnote', CNoteRoutes);
app.use('/phone/oncall-cnote', onCallCNoteRouts);
app.use('/phone/oncall', OnCallRoutes);
app.use('/master/pm-doc-master', pmDocMasterRoutes);
app.use('/api/notifications', notificationRoutes);

// Bulk Upload 

app.use('/bulk/equipment', EquipmentBulk);
app.use('/bulk/aerb', AerbBulk);
app.use('/bulk/product', ProductBulk);
app.use('/bulk/checklist', ChecklistBulk);
app.use('/bulk/amccontract', AmcContractBulk);
app.use('/bulk/dealerstock', DealerStockBulk);
app.use('/bulk/hubstock', HubStockBulk);
app.use('/bulk/pendingcomplaints', PendingComplaintsBulk);
app.use('/bulk/spare-master', SpareMasterBulk);
app.use('/bulk/pendinginstallation', pendingInstallationBulk);
app.use('/bulk/customer', CustomerBulk);
app.use('/bulk/replaced-part-codes', replacedPartCodeUpload);
app.use('/bulk/reported-problem', ReportedProblemBulk);
app.use('/bulk/warranty-code', WarrantyCodeBulk);
app.use('/bulk/cmc-ncmcprice', CmcNcmcPriceBulk);



// Excel Download 
// Master Excel
app.use('/excel/users', userExcelRoutes);
app.use('/excel/aerb', aerbExcelRoutes);
app.use('/excel/dealers', dealerExcelRoutes);
app.use('/excel/branches', branchExcelRoutes);
app.use('/excel/products', productExcelRoutes);
app.use('/excel/checklists', checklistExcelRoutes);
app.use('/excel/equipments', equipmentExcelRoutes)
app.use('/excel/complainttypes', complaintTypeExcelRoutes);
app.use('/excel/sparemaster', spareMasterExcelRoutes);
app.use('/excel/pmdocmaster', pmDocMasterExcelRoutes);
app.use('/excel/formatmaster', formatMasterExcelRoutes);
app.use('/excel/warrantycodes', warrantyCodeExcelRoutes);
app.use('/excel/reportedproblems', reportedProblemExcelRoutes);
app.use('/excel/replacedpartcodes', replacedPartCodeExcelRoutes);
app.use('/excel/pm', pmExcelRoutes);
// Upload Excel
app.use('/excel/customers', customerExcelRoutes);
app.use('/excel/hubstock', hubStockExcelRoutes);
app.use('/excel/dealerstock', dealerStockExcelRoutes);
app.use('/excel/amccontracts', amcContractExcelRoutes);
app.use('/excel/pendingcomplaints', pendingComplaintsExcelRoutes);
app.use('/excel/pendinginstallations', pendingInstallationExcelRoutes);
// Admin Excel
app.use('/excel/geo', geoExcelRoutes);
app.use('/excel/countries', countryExcelRoutes);
app.use('/excel/regions', regionExcelRoutes);
app.use('/excel/states', stateExcelRoutes);
app.use('/excel/cities', cityExcelRoutes);
app.use('/excel/departments', departmentExcelRoutes);
app.use('/excel/productgroups', productGroupExcelRoutes);
app.use('/excel/checklisttypes', checklistTypeExcelRoutes);
app.use('/excel/checkpointtypes', checkpointTypeExcelRoutes);
app.use('/excel/cmcncmcyears', cmcNcmcYearExcelRoutes);
app.use('/excel/cmcncmcprices', cmcNcmcPriceExcelRoutes);
app.use('/excel/cmcncmctds', cmcNcmcTdsExcelRoutes);
app.use('/excel/gst', gstExcelRoutes);
app.use('/excel/discounts', discountExcelRoutes);
app.use('/excel/servicecharges', serviceChargeExcelRoutes);
// Routes
app.get('/', (req, res) => {
  res.send('Hello World!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port v2 ${PORT}`);
});
