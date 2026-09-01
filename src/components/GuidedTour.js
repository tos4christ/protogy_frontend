import React from 'react';

// ---------------------------------------------------------------------------
// GuidedTour — a lightweight, dependency-free onboarding walkthrough.
//
// Highlights one element on screen at a time with a "spotlight" (a single
// div using the box-shadow-cutout trick: a transparent box whose enormous
// box-shadow darkens everything else, so no separate overlay + mask/SVG is
// needed) and a tooltip card describing it, with Back/Next/Skip controls.
//
// Usage:
//   <GuidedTour tourId="dashboard" steps={steps} autoStart />
// Each step: { target: '[data-tour="disco-filter"]' | null, title, body,
//              placement: 'bottom' | 'top' (optional, default 'bottom') }
// A null target renders a centered welcome/closing card with no spotlight.
//
// First-run behaviour: completion is stored in localStorage per tourId, so
// it fires once per browser/device (exactly "first sign-in on this
// device") and never again unless explicitly replayed via <TourRestartButton>.
// ---------------------------------------------------------------------------

const seenKey = (tourId) => `protogy_tour_seen_${tourId}_v1`;

class GuidedTour extends React.Component {
  constructor(props) {
    super(props);
    this.state = { active: false, stepIndex: 0, rect: null, ready: false };
    this.retryTimer = null;
    this.onResize = this.recalc.bind(this);
  }

  componentDidMount() {
    const { tourId, autoStart } = this.props;
    if (autoStart && !localStorage.getItem(seenKey(tourId))) {
      // Small delay lets the screen's own data finish its first load, so
      // early steps have something real to point at rather than an empty
      // table or a still-loading chart.
      this.startTimer = setTimeout(() => this.start(), 700);
    }
    window.addEventListener('resize', this.onResize);
    window.addEventListener('scroll', this.onResize, true);
  }

  componentWillUnmount() {
    clearTimeout(this.startTimer);
    clearTimeout(this.retryTimer);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('scroll', this.onResize, true);
  }

  start() {
    this.setState({ active: true, stepIndex: 0 }, () => this.locateStep());
  }

  finish(markSeen = true) {
    if (markSeen) localStorage.setItem(seenKey(this.props.tourId), '1');
    this.setState({ active: false, rect: null });
    if (this.props.onDone) this.props.onDone();
  }

  locateStep(attempt = 0) {
    const step = this.props.steps[this.state.stepIndex];
    if (!step) return this.finish();
    if (!step.target) { this.setState({ rect: null, ready: true }); return; }
    const el = document.querySelector(step.target);
    if (!el) {
      // The target may not exist yet (e.g. a filter-dependent table). Retry
      // briefly, then just skip to the next step rather than getting stuck.
      if (attempt < 6) {
        this.retryTimer = setTimeout(() => this.locateStep(attempt + 1), 250);
        return;
      }
      return this.next();
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.retryTimer = setTimeout(() => this.recalc(), 260);
  }

  recalc() {
    if (!this.state.active) return;
    const step = this.props.steps[this.state.stepIndex];
    if (!step || !step.target) return;
    const el = document.querySelector(step.target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    this.setState({
      rect: { top: r.top, left: r.left, width: r.width, height: r.height },
      ready: true,
    });
  }

  next() {
    const { steps } = this.props;
    const nextIndex = this.state.stepIndex + 1;
    if (nextIndex >= steps.length) return this.finish();
    this.setState({ stepIndex: nextIndex, ready: false }, () => this.locateStep());
  }

  back() {
    if (this.state.stepIndex === 0) return;
    this.setState({ stepIndex: this.state.stepIndex - 1, ready: false }, () => this.locateStep());
  }

  render() {
    const { active, rect, stepIndex, ready } = this.state;
    const { steps } = this.props;
    if (!active || !ready) return null;
    const step = steps[stepIndex];
    const isLast = stepIndex === steps.length - 1;
    const PAD = 8;

    const spotlight = rect ? (
      <div style={{
        position: 'fixed',
        top: rect.top - PAD, left: rect.left - PAD,
        width: rect.width + PAD * 2, height: rect.height + PAD * 2,
        borderRadius: 10,
        boxShadow: '0 0 0 9999px rgba(15,23,35,0.62)',
        border: '2px solid #4f9eff',
        zIndex: 9998,
        pointerEvents: 'none',
        transition: 'top .25s ease, left .25s ease, width .25s ease, height .25s ease',
      }} />
    ) : (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,35,0.62)', zIndex: 9998 }} />
    );

    // Position the tooltip card below the target by default, flipping above
    // if there isn't room, and centering on screen when there's no target.
    let cardStyle = {
      position: 'fixed', zIndex: 9999, width: 340,
      transition: 'top .25s ease, left .25s ease',
    };
    if (rect) {
      const spaceBelow = window.innerHeight - (rect.top + rect.height);
      const below = spaceBelow > 200 || step.placement === 'bottom';
      const top = below ? rect.top + rect.height + PAD + 14 : Math.max(16, rect.top - PAD - 14 - 180);
      let left = rect.left;
      if (left + 340 > window.innerWidth - 16) left = window.innerWidth - 356;
      if (left < 16) left = 16;
      cardStyle = { ...cardStyle, top, left };
    } else {
      cardStyle = { ...cardStyle, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
    }

    return (
      <React.Fragment>
        {spotlight}
        <div className="card tour-card" style={cardStyle}>
          <div className="tour-step-count">Step {stepIndex + 1} of {steps.length}</div>
          <h3 style={{ marginTop: 4 }}>{step.title}</h3>
          <p style={{ marginBottom: 16 }}>{step.body}</p>
          <div className="controls" style={{ marginTop: 0 }}>
            <button className="btn secondary" onClick={() => this.finish()}>Skip tour</button>
            <span style={{ marginLeft: 'auto' }} />
            {stepIndex > 0 && (
              <button className="btn secondary" onClick={() => this.back()}>‹ Back</button>
            )}
            <button className="btn" onClick={() => (isLast ? this.finish() : this.next())}>
              {isLast ? 'Finish' : 'Next ›'}
            </button>
          </div>
        </div>
      </React.Fragment>
    );
  }
}

// Small "?" button any screen can render to let a user replay its tour on
// demand — onboarding shouldn't be a one-shot, easy-to-miss event.
function TourRestartButton({ onClick, label = 'Take the tour' }) {
  return (
    <button className="btn secondary tour-restart-btn" onClick={onClick} title="Take the tour">
      {label ? `? ${label}` : '?'}
    </button>
  );
}

export { GuidedTour, TourRestartButton, seenKey };
export default GuidedTour;
