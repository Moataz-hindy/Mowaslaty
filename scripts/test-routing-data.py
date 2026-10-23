import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("build_routing_network.py")
SPEC = importlib.util.spec_from_file_location("build_routing_network", SCRIPT)
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)


class RoutingDataTests(unittest.TestCase):
    def test_permissions_default_and_optional_restrictions(self):
        self.assertEqual(builder.permission_for_call({}, {}), (True, True))
        self.assertEqual(builder.permission_for_call({"pickup_type": "1", "drop_off_type": "2"}, {}), (False, False))

    def test_repeated_call_occurrences_are_preserved(self):
        calls = builder.ordered_calls([
            {"stop_id": "A", "stop_sequence": "1"},
            {"stop_id": "B", "stop_sequence": "2"},
            {"stop_id": "A", "stop_sequence": "3"},
        ])
        self.assertEqual([call["sequence"] for call in calls], [1, 2, 3])
        self.assertEqual([call["stop_id"] for call in calls], ["A", "B", "A"])

    def test_exact_shipped_direction_coverage(self):
        network = builder.build_network()
        route_ids = {trip["id"] for trip in network["trips"] if trip["source"] == "gtfs"}
        self.assertEqual(len(route_ids), 1783)
        self.assertEqual(route_ids, {r["id"] for r in network["trips"] if r["source"] == "gtfs"})
        self.assertEqual(sum(t["source"] == "metro-manual" for t in network["trips"]), 10)
        self.assertTrue(all(t["calls"] for t in network["trips"]))
        self.assertEqual(network["metadata"]["unmatchedRoadDirections"], [{"id": "MM_NA15_O", "reason": "single-call-trip"}])

    def test_metro_ambiguity_is_reported_instead_of_guessed(self):
        result = builder.match_metro_station("Repeated", "M1", [
            {"id": "a", "name_en": "Repeated", "type": "metro", "lines": ["M1"]},
            {"id": "b", "name_en": "Repeated", "type": "metro", "lines": ["M1"]},
        ])
        self.assertIsNone(result["stop"])
        self.assertEqual(result["reason"], "ambiguous")


if __name__ == "__main__":
    unittest.main()
