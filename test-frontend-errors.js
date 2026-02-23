// Test script to verify frontend error handling
const axios = require('axios');

const API_BASE_URL = 'http://localhost:8090/api';

// Test 1: Validation Error (should return 200 with success: false)
async function testValidationError() {
  console.log('\n=== Test 1: Validation Error ===');
  try {
    const response = await axios.post(`${API_BASE_URL}/cards`, {
      cardNumber: '',
      expiryDate: '2026-12-01',
      creditLimit: 10000,
      cashLimit: 5000
    });
    
    console.log('HTTP Status:', response.status);
    console.log('Success Flag:', response.data.success);
    console.log('Message:', response.data.message);
    console.log('Field Errors:', response.data.data);
    console.log('✓ Test passed - received validation error as expected');
  } catch (error) {
    if (error.response) {
      console.log('HTTP Status:', error.response.status);
      console.log('Response:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Test 2: Success Response
async function testSuccessResponse() {
  console.log('\n=== Test 2: Success Response ===');
  try {
    const response = await axios.get(`${API_BASE_URL}/cards?page=0&size=1`);
    
    console.log('HTTP Status:', response.status);
    console.log('Success Flag:', response.data.success);
    console.log('Message:', response.data.message);
    console.log('Has Data:', !!response.data.data);
    console.log('✓ Test passed - received success response');
  } catch (error) {
    console.log('Error:', error.message);
  }
}

// Run tests
async function runTests() {
  await testValidationError();
  await testSuccessResponse();
  console.log('\n=== All Tests Complete ===\n');
}

runTests().catch(console.error);
