export function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed-size brand mark served from /public
    <img src="/icon-192.png" width={size} height={size} alt="PitchBorn" className={`rounded-[22%] ${className}`} />
  );
}
