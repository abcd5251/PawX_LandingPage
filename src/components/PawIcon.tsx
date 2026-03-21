const PawIcon = ({ size = 32, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <ellipse cx="32" cy="42" rx="14" ry="12" fill="hsl(28, 90%, 55%)" />
    <ellipse cx="18" cy="24" rx="7" ry="9" fill="hsl(28, 90%, 55%)" transform="rotate(-10 18 24)" />
    <ellipse cx="32" cy="18" rx="7" ry="9" fill="hsl(28, 90%, 55%)" />
    <ellipse cx="46" cy="24" rx="7" ry="9" fill="hsl(28, 90%, 55%)" transform="rotate(10 46 24)" />
  </svg>
);

export default PawIcon;
