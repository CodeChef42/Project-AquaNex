import React from 'react';
import aquanexLogo from '@/assets/Picture1.png'; // ✅ import from assets

interface LogoProps {
  className?: string;
  withText?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  textColor?: string;
}

const Logo = ({ className = '', withText = true, size = 'md', textColor }: LogoProps) => {

  const sizeClasses = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-14',
    xl: 'h-16'
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={aquanexLogo} // ✅ use imported asset
        alt="AquaNex Logo"
        className={`${sizeClasses[size]} w-auto object-contain`}
      />
      {withText && (
        <span
          className={`font-semibold ${textSizes[size]}`}
          style={{ color: textColor ?? 'inherit' }}
        >
          AquaNex
        </span>
      )}
    </div>
  );
};

export default Logo;
