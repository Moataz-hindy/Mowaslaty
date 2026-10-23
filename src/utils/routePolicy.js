/**
 * Exact application-direction exclusions. Newer preference-based exclusions
 * are not claims that a route is fake, absent, or independently disproven.
 * Keys are app route IDs because source route IDs may be shared.
 */
export const ROUTE_EXCLUSIONS = Object.freeze({
  P_O_14_GZ007_O: Object.freeze({
    status: 'disputed; pending verification',
    reason: 'Dandy Mall–Lebanon Square direction has been disputed by the user based on a community report.',
    evidence: 'The community report supplied no citation. TfC documents fieldwork and route traces, but does not verify every current service individually: https://portal.transport-data.org/%40tfc/tfc-cairo-gtfs-for-public-road-transport'
  }),
  oacehl0X7OcJby1R4Oba0: Object.freeze({
    status: 'disputed; pending verification',
    reason: 'Reverse Dandy Mall–Lebanon Square direction has been disputed by the user based on a community report.',
    evidence: 'The community report supplied no citation. TfC documents fieldwork and route traces, but does not verify every current service individually: https://portal.transport-data.org/%40tfc/tfc-cairo-gtfs-for-public-road-transport'
  }),
  P_O_14_IC038_O: Object.freeze({
    status: 'pending verification',
    reason: 'Sphinx Airport direction remains temporarily hidden pending exact-route verification; evidence about public access conflicts.',
    evidence: 'Veto announced public collective transport to Sphinx Airport in 2023, but that announcement does not verify this exact 14-seat route or current operation: https://www.vetogate.com/4956553. Flydubai describes taxi/private transfer and public transport in nearby squares, but does not establish that no public service exists: https://www.flydubai.com/ar-us/destinations/airports/sphinx-international-airport/'
  }),
  P_O_14_IC038_R: Object.freeze({
    status: 'pending verification',
    reason: 'Sphinx Airport direction remains temporarily hidden pending exact-route verification; evidence about public access conflicts.',
    evidence: 'Veto announced public collective transport to Sphinx Airport in 2023, but that announcement does not verify this exact 14-seat route or current operation: https://www.vetogate.com/4956553. Flydubai describes taxi/private transfer and public transport in nearby squares, but does not establish that no public service exists: https://www.flydubai.com/ar-us/destinations/airports/sphinx-international-airport/'
  }),
  P_O_14_CA164_R: Object.freeze({
    status: 'excluded by user preference',
    reason: 'The user requested removal from the app after reviewing the Gemini report audit; this is a product preference, not a finding that the historical service is absent or fake.',
    evidence: 'The route audit found historical fare-schedule and street-reporting evidence, but no 2026 service confirmation: docs/gemini-route-audit-2026-10-23.md'
  }),
  P_O_14_CA164_O: Object.freeze({
    status: 'excluded by user preference',
    reason: 'The user requested removal from the app after reviewing the Gemini report audit; this is a product preference, not a finding that the historical service is absent or fake.',
    evidence: 'The route audit found historical fare-schedule and street-reporting evidence, but no 2026 service confirmation: docs/gemini-route-audit-2026-10-23.md'
  }),
  'ePNQk9H2GgQ-Cbow7POH4': Object.freeze({
    status: 'excluded by user preference',
    reason: 'The user requested removal from the app after reviewing the Gemini report audit; this is a product preference, not a finding that the historical service is absent or fake.',
    evidence: 'The route audit found historical schedule and street-reporting evidence for this route family, but no 2026 service confirmation: docs/gemini-route-audit-2026-10-23.md'
  }),
  TnxdfTNGoloPBPxsVd3z7: Object.freeze({
    status: 'excluded by user preference',
    reason: 'The user requested removal from the app after reviewing the Gemini report audit; this is a product preference, not a finding that the historical service is absent or fake.',
    evidence: 'The route audit found historical schedule and street-reporting evidence for this route family, but no 2026 service confirmation: docs/gemini-route-audit-2026-10-23.md'
  }),
  duOxQcPZP8dTe9lKJ7r8r: Object.freeze({
    status: 'excluded by user preference',
    reason: 'The user requested removal from the app after reviewing the Gemini report audit; this is a product preference, not a finding that the historical service is absent or fake.',
    evidence: 'The route audit found a historical fare-schedule listing for this route family; current operation is unconfirmed: docs/gemini-route-audit-2026-10-23.md'
  }),
  Bdl1wVURvHT6n_Nao9mGM: Object.freeze({
    status: 'excluded by user preference',
    reason: 'The user requested removal from the app after reviewing the Gemini report audit; this is a product preference, not a finding that the historical service is absent or fake.',
    evidence: 'The route audit found a historical fare-schedule listing for this route family; current operation is unconfirmed: docs/gemini-route-audit-2026-10-23.md'
  }),
  P_O_14_IC005_R: Object.freeze({
    status: 'excluded by user preference',
    reason: 'The user requested removal from the app after reviewing the Gemini report audit; this is a product preference, not a finding that the historical service is absent or fake.',
    evidence: 'The route audit found current community guidance for public Smart Village stand access, but did not verify this exact app direction: docs/gemini-route-audit-2026-10-23.md'
  }),
  P_O_14_IC005_O: Object.freeze({
    status: 'excluded by user preference',
    reason: 'The user requested removal from the app after reviewing the Gemini report audit; this is a product preference, not a finding that the historical service is absent or fake.',
    evidence: 'The route audit found current community guidance for public Smart Village stand access, but did not verify this exact app direction: docs/gemini-route-audit-2026-10-23.md'
  }),
  P_O_14_IC050_R: Object.freeze({
    status: 'excluded by user preference',
    reason: 'The user requested removal from the app after reviewing the Gemini report audit; this is a product preference, not a finding that the historical service is absent or fake.',
    evidence: 'The route audit identifies a New Cairo endpoint, rather than Obour/Shorouk, and does not confirm 2026 operation: docs/gemini-route-audit-2026-10-23.md'
  }),
  P_O_14_IC050_O: Object.freeze({
    status: 'excluded by user preference',
    reason: 'The user requested removal from the app after reviewing the Gemini report audit; this is a product preference, not a finding that the historical service is absent or fake.',
    evidence: 'The route audit identifies a New Cairo endpoint, rather than Obour/Shorouk, and does not confirm 2026 operation: docs/gemini-route-audit-2026-10-23.md'
  }),
  'rqv6KxE8qYSbJ-a4xcXsK': Object.freeze({
    status: 'excluded by user preference',
    reason: 'The user requested removal from the app after reviewing the Gemini report audit; this is a product preference, not a finding that the historical service is absent or fake.',
    evidence: 'The route audit found a Qalyub Junction endpoint and opposite-direction sibling; current operation is unconfirmed: docs/gemini-route-audit-2026-10-23.md'
  }),
  'JCPiG-iikHSYZMr2lcfF2': Object.freeze({
    status: 'excluded by user preference',
    reason: 'The user requested removal from the app after reviewing the Gemini report audit; this is a product preference, not a finding that the historical service is absent or fake.',
    evidence: 'The route audit found a Qalyub Junction endpoint and opposite-direction sibling; current operation is unconfirmed: docs/gemini-route-audit-2026-10-23.md'
  })
});

const isQuarantined = id => Object.hasOwn(ROUTE_EXCLUSIONS, id);

export function filterRouteSummary(routes) {
  return routes.filter(route => !isQuarantined(route.id));
}

export function filterRouteGeometry(geometry) {
  return Object.fromEntries(Object.entries(geometry).filter(([id]) => !isQuarantined(id)));
}

export function filterRoutingNetwork(network) {
  return {
    ...network,
    routes: network.routes.filter(route => !isQuarantined(route.id)),
    trips: network.trips.filter(trip => !isQuarantined(trip.appRouteId))
  };
}
