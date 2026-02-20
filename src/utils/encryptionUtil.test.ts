// Payload Encryption Test Suite
// Run this in browser console to test encryption functionality

import { encryptPayload, decryptPayload, generateEncryptionKey, hashString } from './encryptionUtil';

console.log('🔐 Payload Encryption Test Suite');
console.log('================================\n');

// Test 1: Basic Encryption/Decryption
async function testBasicEncryption() {
  console.log('Test 1: Basic Encryption/Decryption');
  console.log('-------------------------------------');
  
  const testData = {
    cardNumber: '4532015112830366',
    expiryDate: '2025-12-01',
    creditLimit: 50000,
    cashLimit: 10000
  };
  
  console.log('Original Data:', testData);
  
  const { encryptedData, encryptionKey } = await encryptPayload(testData);
  console.log('Encrypted Data (truncated):', encryptedData.substring(0, 50) + '...');
  console.log('Encryption Key (truncated):', encryptionKey.substring(0, 50) + '...');
  console.log('Encrypted Data Length:', encryptedData.length, 'bytes');
  
  const decrypted = await decryptPayload(encryptedData, encryptionKey);
  console.log('Decrypted Data:', decrypted);
  
  const match = JSON.stringify(testData) === JSON.stringify(decrypted);
  console.log('✅ Encryption/Decryption Match:', match ? 'PASS' : 'FAIL');
  console.log('');
  
  return match;
}

// Test 2: Unique Keys Per Request
async function testUniqueKeys() {
  console.log('Test 2: Unique Keys Per Request');
  console.log('--------------------------------');
  
  const testData = { test: 'same data' };
  
  const result1 = await encryptPayload(testData);
  const result2 = await encryptPayload(testData);
  
  console.log('Key 1 (truncated):', result1.encryptionKey.substring(0, 30) + '...');
  console.log('Key 2 (truncated):', result2.encryptionKey.substring(0, 30) + '...');
  console.log('Encrypted Data 1 (truncated):', result1.encryptedData.substring(0, 30) + '...');
  console.log('Encrypted Data 2 (truncated):', result2.encryptedData.substring(0, 30) + '...');
  
  const keysAreDifferent = result1.encryptionKey !== result2.encryptionKey;
  const ciphertextsAreDifferent = result1.encryptedData !== result2.encryptedData;
  
  console.log('✅ Keys are unique:', keysAreDifferent ? 'PASS' : 'FAIL');
  console.log('✅ Ciphertexts are different:', ciphertextsAreDifferent ? 'PASS' : 'FAIL');
  console.log('');
  
  return keysAreDifferent && ciphertextsAreDifferent;
}

// Test 3: Tamper Detection
async function testTamperDetection() {
  console.log('Test 3: Tamper Detection');
  console.log('-------------------------');
  
  const testData = { amount: 1000 };
  const { encryptedData, encryptionKey } = await encryptPayload(testData);
  
  // Tamper with encrypted data
  const tamperedData = encryptedData.substring(0, encryptedData.length - 5) + 'XXXXX';
  
  console.log('Original encrypted (truncated):', encryptedData.substring(0, 30) + '...');
  console.log('Tampered encrypted (truncated):', tamperedData.substring(0, 30) + '...');
  
  try {
    await decryptPayload(tamperedData, encryptionKey);
    console.log('❌ Tamper Detection: FAIL (should have thrown error)');
    console.log('');
    return false;
  } catch (error) {
    console.log('✅ Tamper Detection: PASS (correctly detected tampering)');
    console.log('Error:', error instanceof Error ? error.message : 'Unknown error');
    console.log('');
    return true;
  }
}

// Test 4: Large Payload
async function testLargePayload() {
  console.log('Test 4: Large Payload Handling');
  console.log('-------------------------------');
  
  const largePayload = {
    cardNumber: '4532015112830366',
    expiryDate: '2025-12-01',
    creditLimit: 50000,
    cashLimit: 10000,
    metadata: Array(100).fill({ key: 'value', nested: { data: 'test' } })
  };
  
  const startTime = performance.now();
  const { encryptedData, encryptionKey } = await encryptPayload(largePayload);
  const encryptTime = performance.now() - startTime;
  
  const decryptStart = performance.now();
  const decrypted = await decryptPayload(encryptedData, encryptionKey);
  const decryptTime = performance.now() - decryptStart;
  
  console.log('Original Size:', JSON.stringify(largePayload).length, 'bytes');
  console.log('Encrypted Size:', encryptedData.length, 'bytes');
  console.log('Encryption Time:', encryptTime.toFixed(2), 'ms');
  console.log('Decryption Time:', decryptTime.toFixed(2), 'ms');
  console.log('Total Time:', (encryptTime + decryptTime).toFixed(2), 'ms');
  
  const match = JSON.stringify(largePayload) === JSON.stringify(decrypted);
  console.log('✅ Large Payload Test:', match ? 'PASS' : 'FAIL');
  console.log('');
  
  return match;
}

// Test 5: Key Generation
async function testKeyGeneration() {
  console.log('Test 5: Key Generation');
  console.log('----------------------');
  
  const key1 = await generateEncryptionKey();
  const key2 = await generateEncryptionKey();
  
  console.log('Generated Key 1 Length:', key1.length);
  console.log('Generated Key 2 Length:', key2.length);
  console.log('Key 1 (truncated):', key1.substring(0, 30) + '...');
  console.log('Key 2 (truncated):', key2.substring(0, 30) + '...');
  
  const keysAreDifferent = key1 !== key2;
  const keyLengthCorrect = key1.length === 44; // Base64 encoded 32 bytes
  
  console.log('✅ Keys are unique:', keysAreDifferent ? 'PASS' : 'FAIL');
  console.log('✅ Key length correct:', keyLengthCorrect ? 'PASS' : 'FAIL');
  console.log('');
  
  return keysAreDifferent && keyLengthCorrect;
}

// Test 6: Hash Function
async function testHashing() {
  console.log('Test 6: Hash Function');
  console.log('---------------------');
  
  const hash1 = await hashString('test-string');
  const hash2 = await hashString('test-string');
  const hash3 = await hashString('different-string');
  
  console.log('Hash of "test-string":', hash1.substring(0, 30) + '...');
  console.log('Hash of "test-string" again:', hash2.substring(0, 30) + '...');
  console.log('Hash of "different-string":', hash3.substring(0, 30) + '...');
  
  const sameInputSameHash = hash1 === hash2;
  const differentInputDifferentHash = hash1 !== hash3;
  
  console.log('✅ Same input = same hash:', sameInputSameHash ? 'PASS' : 'FAIL');
  console.log('✅ Different input = different hash:', differentInputDifferentHash ? 'PASS' : 'FAIL');
  console.log('');
  
  return sameInputSameHash && differentInputDifferentHash;
}

// Run all tests
export async function runAllTests() {
  console.clear();
  console.log('🔐 PAYLOAD ENCRYPTION TEST SUITE');
  console.log('=================================\n');
  
  const results = [];
  
  try {
    results.push(await testBasicEncryption());
    results.push(await testUniqueKeys());
    results.push(await testTamperDetection());
    results.push(await testLargePayload());
    results.push(await testKeyGeneration());
    results.push(await testHashing());
    
    console.log('=================================');
    console.log('TEST SUMMARY');
    console.log('=================================');
    console.log('Total Tests:', results.length);
    console.log('Passed:', results.filter(r => r).length);
    console.log('Failed:', results.filter(r => !r).length);
    console.log('Success Rate:', (results.filter(r => r).length / results.length * 100).toFixed(0) + '%');
    console.log('');
    
    if (results.every(r => r)) {
      console.log('✅ ALL TESTS PASSED! 🎉');
      console.log('Encryption implementation is working correctly.');
    } else {
      console.log('❌ SOME TESTS FAILED');
      console.log('Please review the implementation.');
    }
    
  } catch (error) {
    console.error('❌ Test suite failed with error:', error);
  }
}

// Auto-run tests
runAllTests();
