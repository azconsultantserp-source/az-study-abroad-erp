/**
 * Fixed, decorative aurora background for the app working area. The base
 * gradient is theme-aware (near-white in light, deep slate in dark) so glass
 * cards and data tables stay perfectly readable on top in both modes.
 */
export function AuroraBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="az-app-bg absolute inset-0" />
      <div className="az-aurora-orb az-animate-aurora -left-32 -top-28 h-[30rem] w-[30rem] bg-az-teal/10" />
      <div
        className="az-aurora-orb az-animate-aurora -bottom-40 right-0 h-[34rem] w-[34rem] bg-az-gold/10"
        style={{ animationDelay: "-7s" }}
      />
      <div
        className="az-aurora-orb az-animate-aurora left-1/2 top-1/3 h-72 w-72 bg-emerald-300/10"
        style={{ animationDelay: "-13s" }}
      />
      <div className="absolute inset-0 az-dot-grid-light" />
    </div>
  );
}
