import test from 'node:test';
import assert from 'node:assert/strict';
import { planJourney } from './tripPlanner.js';

test('keeps only the best stop pair for each route while preserving different routes', () => {
  const route = { id: 'minibus-51-outbound', route_id: 'minibus-51', shortName: '51', vehicle: 'Minibus' };
  const alternateRoute = { id: 'minibus-52', route_id: 'minibus-52', shortName: '52', vehicle: 'Minibus' };
  const network = {
    version: 'duplicate-trip-records',
    stops: [
      { id: 'origin-stop', lat: 30, lng: 31 },
      { id: 'middle-stop', lat: 30.005, lng: 31 },
      { id: 'destination-stop', lat: 30.01, lng: 31 }
    ],
    routes: [route, alternateRoute],
    trips: [...['trip-a', 'trip-b'].map(id => ({
      id,
      route,
      calls: [
        { stopId: 'origin-stop', sequence: 1, distanceMeters: 0, canBoard: true, canAlight: false },
        { stopId: 'middle-stop', sequence: 2, distanceMeters: 550, canBoard: true, canAlight: true },
        { stopId: 'destination-stop', sequence: 3, distanceMeters: 1110, canBoard: true, canAlight: true }
      ]
    })), {
      id: 'trip-other-route',
      route: alternateRoute,
      calls: [
        { stopId: 'origin-stop', sequence: 1, distanceMeters: 0, canBoard: true, canAlight: false },
        { stopId: 'middle-stop', sequence: 2, distanceMeters: 550, canBoard: true, canAlight: true },
        { stopId: 'destination-stop', sequence: 3, distanceMeters: 1110, canBoard: true, canAlight: true }
      ]
    }]
  };

  const result = planJourney([30, 31], [30.01, 31], network);

  assert.equal(result.directRoutes.length, 2);
  assert.deepEqual(new Set(result.directRoutes.map(journey => journey.legs.find(leg => leg.kind === 'ride').route.route_id)),
    new Set([route.route_id, alternateRoute.route_id]));
});
