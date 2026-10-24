import BrandLogo from "./BrandLogo";

/** Decorative first-open intro; CSS dismisses it even without JavaScript. */
export default function StartupSplash() {
  return (
    <div className="startup-splash" aria-hidden="true">
      <div className="startup-splash__halo" />
      <div className="startup-splash__content">
        <div className="startup-splash__logo"><BrandLogo size={220} /></div>
        <p className="startup-splash__tagline">Ambikapur ka apna food partner</p>
        <div className="startup-splash__road">
          <span className="startup-splash__runner" />
        </div>
        <div className="startup-splash__dots"><span /><span /><span /></div>
      </div>
    </div>
  );
}
