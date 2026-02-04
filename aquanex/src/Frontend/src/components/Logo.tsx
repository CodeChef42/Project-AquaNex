import React from 'react';

interface LogoProps {
  className?: string;
  withText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const Logo = ({ className = '', withText = true, size = 'md' }: LogoProps) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src="/aquanex-logo.png"
        alt="AquaNex Logo"
        className={sizeClasses[size]}
      />
    </div>
  );
};

export default Logo;
