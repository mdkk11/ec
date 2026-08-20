export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-line motion-reduce:animate-none ${className}`}
    />
  )
}
