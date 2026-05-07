import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div className={`glass rounded-2xl p-8 sm:p-10 ${className}`} {...rest}>
      {children}
    </div>
  );
}
