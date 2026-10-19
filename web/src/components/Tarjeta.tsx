import type { HTMLAttributes, ReactNode } from 'react'

interface TarjetaProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Tarjeta({ className = '', children, ...props }: TarjetaProps) {
  return (
    <div
      className={`tarjeta rounded-2xl bg-white shadow-sm shadow-black/5 dark:bg-superficie-dark dark:shadow-none ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
