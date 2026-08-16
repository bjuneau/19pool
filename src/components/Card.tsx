import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div className={`glass rounded-2xl p-5 sm:p-8 ${className}`} {...rest}>
      {children}
    </div>
  );
}
