require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Driver } = require('./models');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bus-tracker';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to DB');

  // Create test passenger
  let user = await User.findOne({ phone: '+911234567890' });
  if (!user) {
    user = await User.create({ phone: '+911234567890', name: 'E2E Rider' });
    console.log('Created test user', user._id);
  } else console.log('Test user exists', user._id);

  // Create test driver
  let driver = await Driver.findOne({ vehicleId: 'E2E-DRIVER-1' });
  if (!driver) {
    const pinHash = await bcrypt.hash('1234', 8);
    driver = await Driver.create({
      vehicleId: 'E2E-DRIVER-1',
      name: 'E2E Driver',
      phone: '+919876543210',
      vehicleType: 'cab',
      vehicleNumber: 'OD-E2E-001',
      pinHash,
      isApproved: true,
      onDuty: false,
    });
    console.log('Created test driver', driver._id);
  } else console.log('Test driver exists', driver._id);

  await mongoose.connection.close();
  console.log('Seed complete');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
