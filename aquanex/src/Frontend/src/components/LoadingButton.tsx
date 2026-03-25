import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * AquaNex LoadingButton
 *
 * Drop-in replacement for any submit / action button.
 * Shows animated water drops when loading=true.
 *
 * Usage:
 *   <LoadingButton type="submit" loading={loading} loadingText="Signing in…">
 *     Sign In
 *   </LoadingButton>
 */
const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading = false,
  loadingText = 'Loading…',
  children,
  className,
  disabled,
  ...props
}) => {
  return (
    <Button
      disabled={loading || disabled}
      className={cn(
        'w-full h-11 rounded-xl font-bold text-white text-sm tracking-wide border-0',
        'bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-600',
        'hover:from-cyan-400 hover:via-teal-400 hover:to-cyan-500',
        'shadow-lg shadow-cyan-400/30 dark:shadow-cyan-900/50',
        'transition-all duration-200',
        loading && [
          '[background-size:200%_200%]',
          'animate-btnShimmer',
          'opacity-90',
          'cursor-not-allowed',
        ],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <WaterDrops />
          {loadingText}
        </span>
      ) : (
        children
      )}
    </Button>
  );
};

const WaterDrops = () => (
  <span className="flex items-center gap-[5px]">
    {(['0s', '0.15s', '0.3s'] as const).map((delay, i) => (
      <span
        key={i}
        className="block w-[6px] h-[8px] bg-white/90 rounded-[50%_50%_50%_50%_/_60%_60%_40%_40%]
          animate-dropPulse"
        style={{ animationDelay: delay }}
      />
    ))}
  </span>
);

export default LoadingButton;