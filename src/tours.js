// Step content for each guided tour. Kept separate from GuidedTour.js so
// the wording can be edited without touching the tour engine, and reused
// if these screens ever need a second, deeper tour later.

export const dashboardTour = [
  {
    target: null,
    title: '👋 Welcome to the Dashboard',
    body: "This is your fleet-wide overview — every feeder's connectivity, live readings, and today's Data Acquisition Rate (DAR) in one place. Let's take a 60-second tour of what you're looking at.",
  },
  {
    target: '[data-tour="dash-filters"]',
    title: 'Narrow the whole page',
    body: 'Use these two filters to narrow everything below to one Disco (distribution company) or one NERC tariff Band. Leave them on "All" for the full fleet.',
  },
  {
    target: '[data-tour="dash-tiles"]',
    title: 'Fleet at a glance',
    body: 'Four numbers that matter most: total feeders onboarded, how many are online right now, how many are offline, and the fleet-wide average DAR for today.',
  },
  {
    target: '[data-tour="dash-band-toggle"]',
    title: 'Break it down by Band',
    body: 'Click this to reveal a chart and table showing the same numbers split by NERC tariff Band (A–E) instead of the whole fleet — useful for spotting whether one Band is underperforming.',
  },
  {
    target: '[data-tour="dash-live-power"]',
    title: 'Live readings',
    body: 'This table refreshes automatically with each feeder\'s current active power, reactive power, power factor, and frequency.',
    placement: 'top',
  },
  {
    target: '[data-tour="dash-dar-controls"]',
    title: "Today's D.A.R by Feeder",
    body: 'A fleet can have hundreds or thousands of feeders, so this chart is paginated. Use "Per page" and Prev/Next to move through pages, and the Zoom slider to widen the bars when labels feel cramped.',
  },
  {
    target: '[data-tour="dash-pq"]',
    title: 'Power Quality Analytics',
    body: 'Further down, this section flags feeders running a poor power factor (inefficient, costly load) or an unbalanced phase current — real problems invisible from a simple online/offline view.',
    placement: 'top',
  },
  {
    target: null,
    title: "You're all set",
    body: 'That covers the Dashboard. Look for the "? Take the tour" button near the top of any guided screen if you want to see this again.',
  },
];

export const nercTour = [
  {
    target: null,
    title: '👋 Welcome to the NERC View',
    body: "This is the regulatory compliance screen — feeder compliance by Disco, a feeder-level drill-down, and the Excel reports NERC has requested.",
  },
  {
    target: '[data-tour="nerc-filters"]',
    title: 'Narrow by Disco and Band',
    body: 'Combine these two filters to answer questions like "what is the DAR for Band A feeders in AEDC?" — every table and report below follows this selection.',
  },
  {
    target: '[data-tour="nerc-tiles"]',
    title: 'Compliance at a glance',
    body: 'Feeder count, DAR compliance against the configured threshold, the voltage tolerance in use, and how many feeders are currently compliant.',
  },
  {
    target: '[data-tour="nerc-summary-table"]',
    title: 'Executive Summary by Disco',
    body: 'Compliance figures for the selected date, aggregated per Disco — including a 2-day non-compliance count and a 7-day moving average to smooth out single-day spikes.',
  },
  {
    target: '[data-tour="nerc-reports"]',
    title: 'Download regulator reports',
    body: 'These three Excel exports always match whatever Disco/Band/date is currently selected above — clear the filters back to "All" first if you want a fleet-wide report.',
    placement: 'top',
  },
  {
    target: null,
    title: "You're all set",
    body: 'That covers the NERC View. Select a specific Disco or Band above to also reveal a Feeder Drill-Down table for individual feeder detail.',
  },
];

export const explorerTour = [
  {
    target: null,
    title: '👋 Welcome to Feeder Explorer',
    body: "This is where you drill into a single feeder's full history — raw readings, DAR trends, electrical charts, uptime, and data gaps. Let's walk through it.",
  },
  {
    target: '[data-tour="exp-feeder-select"]',
    title: 'Pick a feeder',
    body: 'Start here — choose the feeder you want to investigate by its name and Meter ID. Everything else on this screen follows your selection.',
  },
  {
    target: '[data-tour="exp-view-tabs"]',
    title: 'Six different views',
    body: 'Use this dropdown to switch between: Data (raw readings), DAR (trend over a date range), Charts (voltage/current/power), Uptime, Gaps (missing-data periods), and Details (the feeder\'s onboarding information).',
  },
  {
    target: '[data-tour="exp-date-controls"]',
    title: 'Dates depend on the view',
    body: 'Data, Uptime, and Gaps use a single date. DAR and Charts use a From/To range — and in Charts specifically, the "To" date doubles as the snapshot date for the electrical charts, so there\'s only one date range to think about, not two overlapping fields.',
  },
  {
    target: '[data-tour="exp-content"]',
    title: 'Your results appear here',
    body: 'After picking a feeder, view, and date, click Load. A table appears here for Data/Uptime/Gaps/Details, or a chart appears just below for DAR and Charts views.',
    placement: 'top',
  },
  {
    target: null,
    title: "You're all set",
    body: "That's Feeder Explorer. Try switching to the Charts view with a date range to see a feeder's voltage and power profile over a day.",
  },
];
