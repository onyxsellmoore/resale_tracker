import './LoadingSkeleton.css'

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div data-testid="loading-skeleton">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="skeleton-bar"
          style={{
            height: 20,
            marginBottom: 12,
            width: i % 2 === 0 ? '100%' : '75%',
          }}
        />
      ))}
    </div>
  )
}
