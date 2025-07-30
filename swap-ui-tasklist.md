# Basic commands to setup the UI repo

# 1. Create a new Next.js app (recommended for modern dApps, avoids create-react-app deprecation and polyfill issues)
npx create-next-app@latest swap-ui --typescript
cd swap-ui

# 2. Install dependencies for Ethereum and Tezos wallet connections
npm install ethers @web3-react/core @web3-react/metamask
npm install @taquito/taquito @taquito/beacon-wallet

# 3. (Optional) Install UI and state management libraries
npm install @mui/material @emotion/react @emotion/styled
npm install zustand

# 4. (Recommended) Add polyfills for Buffer and process for web3 compatibility
npm install buffer process

# 5. Add polyfill imports to your next.config.js or _app.tsx (for Next.js 13+)
# In next.config.js:
# webpack: (config) => {
#   config.resolve.fallback = {
#     ...config.resolve.fallback,
#     buffer: require.resolve('buffer/'),
#     process: require.resolve('process/browser'),
#   };
#   return config;
# }

# In _app.tsx (top of file):
# import { Buffer } from 'buffer';
# if (typeof window !== "undefined") {
#   window.Buffer = Buffer;
# }

# 6. Start the development server
npm run dev