import React from 'react';
import { Loader2 } from 'lucide-react';

export type InstacartButtonVariant = 'dark' | 'light' | 'white';

export type InstacartButtonText =
  | 'Get Recipe Ingredients'
  | 'Get Ingredients'
  | 'Shop with Instacart'
  | 'Order with Instacart';

interface InstacartButtonProps {
  variant?: InstacartButtonVariant;
  text?: InstacartButtonText;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  showCount?: number;
}

export function InstacartButton({
  variant = 'dark',
  text = 'Shop with Instacart',
  onClick,
  disabled = false,
  loading = false,
  fullWidth = false,
  className = '',
  showCount,
}: InstacartButtonProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'dark':
        return {
          bg: 'bg-instacart-kale',
          text: 'text-instacart-cashew',
          hover: 'hover:bg-[#002d21]',
          logo: '/Instacart_Logo_Cashew.svg',
        };
      case 'light':
        return {
          bg: 'bg-instacart-cashew',
          text: 'text-instacart-kale',
          hover: 'hover:bg-[#f5e8d4]',
          logo: '/Instacart_Logo_Kale.svg',
        };
      case 'white':
        return {
          bg: 'bg-white border-2 border-instacart-kale',
          text: 'text-instacart-kale',
          hover: 'hover:bg-gray-50',
          logo: '/Instacart_Logo_Kale.svg',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        h-[46px]
        px-[18px]
        py-4
        ${fullWidth ? 'w-full' : ''}
        ${styles.bg}
        ${styles.text}
        ${styles.hover}
        rounded-full
        font-medium
        text-sm
        flex
        items-center
        justify-center
        gap-2
        transition-all
        duration-200
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${className}
      `.replace(/\s+/g, ' ').trim()}
    >
      {loading ? (
        <>
          <Loader2 className="w-5.5 h-5.5 animate-spin" />
          <span>Loading...</span>
        </>
      ) : (
        <>
          <img
            src={styles.logo}
            alt="Instacart"
            className="h-5.5 w-auto"
            style={{ height: '22px' }}
          />
          <span className="whitespace-nowrap">
            {text}
            {showCount !== undefined && showCount > 0 && ` (${showCount})`}
          </span>
        </>
      )}
    </button>
  );
}
