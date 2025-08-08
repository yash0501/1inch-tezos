import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import dynamic from 'next/dynamic';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "1inch Cross-Chain Atomic Swaps",
  description: "Swap tokens between Ethereum and Tezos securely",
};

// Import BeaconWalletProvider with no SSR
const BeaconWalletProvider = dynamic(
  () => import('./components/WalletConnection').then(mod => ({
    default: mod.BeaconWalletProvider
  })),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-700 py-8 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Initializing wallet...</p>
          </div>
        </div>
      </div>
    )
  }
);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <BeaconWalletProvider>{children}</BeaconWalletProvider>
      </body>
    </html>
  );
}