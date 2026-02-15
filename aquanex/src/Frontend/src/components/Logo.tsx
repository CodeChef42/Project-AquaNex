import React from 'react';

interface LogoProps {
  className?: string;
  withText?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Logo = ({ className = '', withText = true, size = 'md' }: LogoProps) => {
  const logoSrc = `${import.meta.env.BASE_URL}aquanex-logo.png`;

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
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={logoSrc}
        alt="AquaNex Logo"
        className={`${sizeClasses[size]} w-auto object-contain`}
      />
      {withText && (
        <span className={`font-semibold ${textSizes[size]} text-foreground`}>
          AquaNex
        </span>
      )}
    </div>
  );
};

export default Logo;
