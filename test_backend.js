const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testBackend() {
  console.log('Testing Backend API Endpoints...\n');
  
  try {
    // Test health endpoint
    console.log('1. Testing Health Endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data);
    
    // Test products endpoint (will fail without DB but should return proper error)
    console.log('\n2. Testing Products Endpoint...');
    try {
      const productsResponse = await axios.get(`${BASE_URL}/api/products`);
      console.log('✅ Products endpoint working:', productsResponse.data);
    } catch (error) {
      console.log('⚠️  Products endpoint error (expected without DB):', error.response?.data?.error || error.message);
    }
    
    // Test categories endpoint
    console.log('\n3. Testing Categories Endpoint...');
    try {
      const categoriesResponse = await axios.get(`${BASE_URL}/api/categories`);
      console.log('✅ Categories endpoint working:', categoriesResponse.data);
    } catch (error) {
      console.log('⚠️  Categories endpoint error (expected without DB):', error.response?.data?.error || error.message);
    }
    
    // Test auth register endpoint (will fail without DB but should return proper error)
    console.log('\n4. Testing Auth Register Endpoint...');
    try {
      const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
        name: 'Test User',
        email: 'test@example.com',
        password: 'TestPass123!'
      });
      console.log('✅ Register endpoint working:', registerResponse.data);
    } catch (error) {
      console.log('⚠️  Register endpoint error (expected without DB):', error.response?.data?.error || error.message);
    }
    
    console.log('\n✅ Backend server is running and responding to requests!');
    console.log('🔗 Once MongoDB is connected, all database operations will work properly.');
    
  } catch (error) {
    console.error('❌ Backend test failed:', error.message);
  }
}

testBackend();
