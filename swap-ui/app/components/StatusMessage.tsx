'use client';

interface StatusMessageProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export default function StatusMessage({ message, type }: StatusMessageProps) {
  const getClasses = () => {
    const base = "p-4 rounded-lg mb-3 font-medium";
    switch (type) {
      case 'success':
        return `${base} bg-green-50 text-green-800 border border-green-200`;
      case 'error':
        return `${base} bg-red-50 text-red-800 border border-red-200`;
      case 'info':
        return `${base} bg-blue-50 text-blue-800 border border-blue-200`;
      case 'warning':
        return `${base} bg-yellow-50 text-yellow-800 border border-yellow-200`;
      default:
        return `${base} bg-gray-50 text-gray-800 border border-gray-200`;
    }
  };

  return (
    <div className={getClasses()}>
      {message}
    </div>
  );
}
