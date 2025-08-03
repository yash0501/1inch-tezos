// test-withdraw.js
// const { ethers } = require('ethers');

// // Configuration from your logs
// const CONFIG = {
//     rpcUrl: 'https://eth-sepolia.g.alchemy.com/public',
//     contractAddress: '0x9Bc05C0f82Cc0B056e9C9995F798EccDa07636E8',
//     privateKey: "0xd822664b1400ed48cb13d1aa55341c74f2ef04307ef71d9be913a28f5ba3a1be", // Replace with your actual private key
//     secret: '0xff0b8afb793fe0b7f309cc29ba01f82fc9c2d709fecc4f192faef8293d51852c',
//     immutables: {
//         orderHash: '0x28158b978a890b12ae9607b470e1a39950dd7330a3af462249036b4893c20df2',
//         hashlock: '0xef37f0cc76673e73f5596627e86d17db44d28c3952375e33fec4017ddbd906cf',
//         maker: '0xC380470bDC53643a7A1C0c90391613A115Fb2278',
//         taker: '0x6cD7f208742840078ea0025677f1fD48eC4f6259',
//         token: '0x0000000000000000000000000000000000000000',
//         amount: '1000000000000000',
//         safetyDeposit: '10000000000000',
//         timelocks: '47293561633798486591397734753785686475233471666441606088002340447578753116352'
//     }
// };

// diagnostic-test.js
const { ethers } = require('ethers');

async function diagnosticTest() {
  const PROVIDER_URL = "https://eth-sepolia.g.alchemy.com/public";
  const PRIVATE_KEY = "0xd822664b1400ed48cb13d1aa55341c74f2ef04307ef71d9be913a28f5ba3a1be";
  const CONTRACT_ADDRESS = "0xacf69e04F18694ABFfF1bB3195e9B1B4Ee23b04E";
  
  const SECRET = "0x51c1ba9b5bb7da5190eadf3576e7256afe9855e2671ca123550c577861ec561d";
  const IMMUTABLES = {
    orderHash: '0x4253ccf8ffc00f404dbcae7e0d0f32d8f5032b103e17352b52e45ab43e27ea47',
    hashlock: '0x9b688c6ce1762414cdbb7bd779a6b57b2a880ade0326e8f959f8a0f54488e7c7',
    maker: '0xC380470bDC53643a7A1C0c90391613A115Fb2278',
    taker: '0x6cD7f208742840078ea0025677f1fD48eC4f6259',
    token: '0x0000000000000000000000000000000000000000',
    amount: '1000000000000000',
    safetyDeposit: '10000000000000',
    timelocks: '47293619597684092136068261992477091873146000585951975491706938000220570517563'
  };

  const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("🔍 DIAGNOSTIC TEST - Finding exact failure point");

  const contractABI = [
    "function withdraw(bytes32 secret, (bytes32 orderHash, bytes32 hashlock, address maker, address taker, address token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) calldata immutables) external",
    "function FACTORY() external view returns (address)",
    "function PROXY_BYTECODE_HASH() external view returns (bytes32)"
  ];

  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);
  const immutablesStruct = {
    orderHash: IMMUTABLES.orderHash,
    hashlock: IMMUTABLES.hashlock,
    maker: IMMUTABLES.maker,
    taker: IMMUTABLES.taker,
    token: IMMUTABLES.token,
    amount: BigInt(IMMUTABLES.amount),
    safetyDeposit: BigInt(IMMUTABLES.safetyDeposit),
    timelocks: BigInt(IMMUTABLES.timelocks)
  };

  // Test 1: Check if onlyValidImmutables is the issue
  console.log('\n🧪 TEST 1: Checking Create2 address validation');
  try {
    const factory = await contract.FACTORY();
    const proxyHash = await contract.PROXY_BYTECODE_HASH();
    console.log(`Factory: ${factory}`);
    console.log(`Proxy Hash: ${proxyHash}`);
    
    // Compute expected address using Create2
    const salt = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "address", "address", "address", "uint256", "uint256", "uint256"],
      [
        immutablesStruct.orderHash,
        immutablesStruct.hashlock,
        immutablesStruct.maker,
        immutablesStruct.taker,
        immutablesStruct.token,
        immutablesStruct.amount,
        immutablesStruct.safetyDeposit,
        immutablesStruct.timelocks
      ]
    ));
    
    const computedAddress = ethers.getCreate2Address(factory, salt, proxyHash);
    console.log(`Computed address: ${computedAddress}`);
    console.log(`Actual address: ${CONTRACT_ADDRESS}`);
    console.log(`Addresses match: ${computedAddress.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()}`);
    
    if (computedAddress.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
      console.log('❌ FOUND THE ISSUE: onlyValidImmutables will fail because Create2 address mismatch!');
      console.log('💡 Your contract was deployed directly, not via Create2 factory');
    }
    
  } catch (error) {
    console.log('❌ Address validation test failed:', error.message);
  }

  // Test 2: Try calling with minimal gas to see early failures
  console.log('\n🧪 TEST 2: Testing with minimal gas limits');
  
  const gasLimits = [50000, 100000, 150000, 200000];
  
  for (const gasLimit of gasLimits) {
    try {
      console.log(`Testing with ${gasLimit} gas...`);
      const tx = await contract.withdraw.populateTransaction(SECRET, immutablesStruct);
      
      const result = await provider.call({
        ...tx,
        gasLimit: gasLimit
      });
      
      console.log(`✅ ${gasLimit} gas: Call succeeded`);
      
    } catch (error) {
      console.log(`❌ ${gasLimit} gas: ${error.message}`);
      if (error.message.includes('out of gas')) {
        console.log('  💡 Out of gas - need more gas');
      } else if (error.message.includes('revert')) {
        console.log('  💡 Reverted - logic error, not gas issue');
      }
    }
  }

  // Test 3: Check individual components
  console.log('\n🧪 TEST 3: Component validation');
  
  // Secret hash check
  const computedHash = ethers.keccak256(SECRET);
  console.log(`Secret hash valid: ${computedHash === IMMUTABLES.hashlock}`);
  
  // Caller check
  const callerAddress = await wallet.getAddress();
  console.log(`Caller is taker: ${callerAddress.toLowerCase() === IMMUTABLES.taker.toLowerCase()}`);
  
  // Balance check
  const balance = await provider.getBalance(CONTRACT_ADDRESS);
  const requiredBalance = BigInt(IMMUTABLES.amount) + BigInt(IMMUTABLES.safetyDeposit);
  console.log(`Contract has sufficient balance: ${balance >= requiredBalance}`);
  console.log(`  Balance: ${ethers.formatEther(balance)} ETH`);
  console.log(`  Required: ${ethers.formatEther(requiredBalance)} ETH`);
}

diagnosticTest().catch(console.error);