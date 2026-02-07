/* =====================================================
   🔐 CREATE ADMIN USER VIA API
===================================================== */

const http = require('http');

const adminData = {
  name: "Admin User",
  username: "admin",
  email: "admin@tengacion.com",
  password: "Admin@123456",
};

const postData = JSON.stringify(adminData);

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/create-admin',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    const response = JSON.parse(data);
    
    if (res.statusCode === 201) {
      console.log('\n✅ ADMIN USER CREATED SUCCESSFULLY!\n');
      console.log('=' .repeat(60));
      console.log('📋 ADMIN LOGIN CREDENTIALS:');
      console.log('=' .repeat(60));
      console.log(`📧 Email:    ${adminData.email}`);
      console.log(`👤 Username: ${adminData.username}`);
      console.log(`🔑 Password: ${adminData.password}`);
      console.log('=' .repeat(60));
      console.log(`\nUser ID: ${response.user.id}`);
      console.log(`Token: ${response.token.substring(0, 20)}...`);
      console.log('\n💡 Use these credentials to login at http://localhost:3000\n');
    } else {
      console.log('\n❌ Error creating admin user:');
      console.log(data + '\n');
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Connection error. Make sure the backend is running on port 5000\n');
  console.error('Error:', error.message);
  console.error('\n💡 Start the backend with: npm start\n');
});

console.log('\n🚀 Creating admin user...\n');

req.write(postData);
req.end();
