const path = require('path');
const fs = require('fs');

console.log('🔍 Environment Variables Debug Script');
console.log('=====================================');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
console.log('\n📁 .env file check:');
console.log('  Path:', envPath);
console.log('  Exists:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  console.log('  Content preview (first 500 chars):');
  const content = fs.readFileSync(envPath, 'utf8');
  console.log('  ' + content.substring(0, 500).replace(/\n/g, '\n  '));
}

// Load dotenv manually if package is not available
try {
  require('dotenv').config();
  console.log('\n✅ dotenv loaded successfully');
} catch (error) {
  console.log('\n⚠️ dotenv package not found, loading .env manually');
  
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          process.env[key.trim()] = value;
        }
      }
    });
    console.log('  ✅ .env file loaded manually');
  } else {
    console.log('  ❌ No .env file found to load');
  }
}

// Check specific environment variables
console.log('\n🔑 Environment Variables:');
const importantVars = [
  'ETHEREUM_PRIVATE_KEY',
  'ETHEREUM_RPC_URL', 
  'SEPOLIA_RPC_URL',
  'TEZOS_PRIVATE_KEY',
  'TEZOS_RPC_URL',
  'RESOLVER_ADDRESS'
];

importantVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`  ${varName}:`, value ? `${value.substring(0, 20)}... (${value.length} chars)` : 'NOT SET');
});

// Test Ethereum private key format
const ethPrivateKey = process.env.ETHEREUM_PRIVATE_KEY;
if (ethPrivateKey) {
  console.log('\n🔐 Ethereum Private Key Analysis:');
  console.log('  Length:', ethPrivateKey.length);
  console.log('  Starts with 0x:', ethPrivateKey.startsWith('0x'));
  console.log('  Is hex (after 0x):', /^0x[a-fA-F0-9]+$/.test(ethPrivateKey));
  console.log('  Expected length:', ethPrivateKey.startsWith('0x') ? 66 : 64);
  
  // Try to create a wallet (without provider)
  try {
    const { ethers } = require('ethers');
    const wallet = new ethers.Wallet(ethPrivateKey);
    console.log('  ✅ Valid private key - Address:', wallet.address);
  } catch (error) {
    console.log('  ❌ Invalid private key:', error.message);
  }
}

// Check for contract artifacts in the correct locations
console.log('\n📦 Contract Artifacts Check:');
const artifactPaths = [
  '../contracts/ethereum/compiled/EscrowSrc.json',
  '../contracts/ethereum/compiled/EscrowDst.json',
  '../contracts/tezos/compiled/EscrowSrc.tz',
  '../contracts/tezos/compiled/EscrowDst.tz'
];

artifactPaths.forEach(relativePath => {
  const fullPath = path.join(__dirname, relativePath);
  console.log(`  ${relativePath}: ${fs.existsSync(fullPath) ? '✅ EXISTS' : '❌ NOT FOUND'}`);
});

console.log('\n🏁 Debug complete');
