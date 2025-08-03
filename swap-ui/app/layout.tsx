import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BeaconWalletProvider } from "./components/WalletConnection";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "1inch Cross-Chain Atomic Swaps",
  description: "Swap tokens between Ethereum and Tezos securely",
};

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
