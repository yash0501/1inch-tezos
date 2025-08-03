'use client';

interface ProgressBarProps {
  currentStep: number;
  totalSteps?: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, totalSteps = 5 }) => {
  const steps = [
    'Connect Wallets',
    'Create Order', 
    'Review & Submit',
    'Contracts Deployed',
    'Reveal Secret'
  ];

  const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="mb-8">
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-sm text-gray-600">
        {steps.map((step, index) => (
          <span key={index} className={currentStep >= index + 1 ? 'font-medium text-blue-600' : ''}>
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}

export default ProgressBar;
