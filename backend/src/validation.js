/**
 * Validates order data
 */
function validateOrder(orderData) {
  const errors = [];
  
  // Required fields
  const requiredFields = [
    'sourceChain', 'targetChain', 'sourceToken', 'targetToken',
    'sourceAmount', 'targetAmount', 'userAddress', 'destinationAddress'
  ];
  
  requiredFields.forEach(field => {
    if (!orderData[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Validate amounts
  if (orderData.sourceAmount && orderData.sourceAmount <= 0) {
    errors.push('Source amount must be positive');
  }
  
  if (orderData.targetAmount && orderData.targetAmount <= 0) {
    errors.push('Target amount must be positive');
  }
  
  // Validate chains
  const supportedChains = ['ethereum', 'tezos'];
  if (orderData.sourceChain && !supportedChains.includes(orderData.sourceChain)) {
    errors.push('Unsupported source chain');
  }
  
  if (orderData.targetChain && !supportedChains.includes(orderData.targetChain)) {
    errors.push('Unsupported target chain');
  }
  
  if (orderData.sourceChain === orderData.targetChain) {
    errors.push('Source and target chains must be different');
  }
  
  // Validate addresses (basic format check)
  if (orderData.userAddress && !isValidAddress(orderData.userAddress, orderData.sourceChain)) {
    errors.push('Invalid user address format');
  }
  
  if (orderData.destinationAddress && !isValidAddress(orderData.destinationAddress, orderData.targetChain)) {
    errors.push('Invalid destination address format');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates resolver data
 */
function validateResolver(resolverData) {
  const errors = [];
  
  if (!resolverData.id) {
    errors.push('Resolver ID is required');
  }
  
  if (!resolverData.supportedChains || !Array.isArray(resolverData.supportedChains)) {
    errors.push('Supported chains array is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Basic address validation
 */
function isValidAddress(address, chain) {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  switch (chain) {
    case 'ethereum':
      // Ethereum address: 0x + 40 hex characters
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    
    case 'tezos':
      // Tezos address: tz1/tz2/tz3/KT1 + base58 characters
      return /^(tz1|tz2|tz3|KT1)[a-km-zA-HJ-NP-Z1-9]{33}$/.test(address);
    
    default:
      return false;
  }
}

module.exports = {
  validateOrder,
  validateResolver,
  isValidAddress
};
