import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('arabic_names', Path(__file__).with_name('localize_arabic_names.py'))
names = importlib.util.module_from_spec(spec)
spec.loader.exec_module(names)


class ArabicNamesTests(unittest.TestCase):
    def test_missing_endpoint_uses_bilingual_evidence_without_reversing_direction(self):
        routes = [
            {'id': 'evidence', 'origin': 'Kafr Tohormos', 'dest': 'Imbaba', 'origin_ar': 'كفر طهرمس', 'dest_ar': 'إمبابة'},
            {'id': 'screenshot', 'origin': 'Kafr Tohormos', 'dest': 'Haram Talbeya',
             'via_stops': ['كفر طهرمس', 'هرم طلبية'], 'dir': 1, 'start_pt': [30, 31]},
        ]
        network = {'routes': [{'id': 'screenshot', 'origin_en': 'Kafr Tohormos'}], 'stops': [], 'trips': [{'id': 'trip', 'calls': ['unchanged']}]}
        original = copy.deepcopy(routes[1])
        names.localize(routes, [], network)
        route = routes[1]
        self.assertEqual((route['origin_ar'], route['dest_ar']), ('كفر طهرمس', 'الطالبية (الهرم)'))
        self.assertEqual((route['origin_en'], route['dest_en']), ('Kafr Tohormos', 'Haram Talbeya'))
        self.assertEqual(route['dest'], 'الطالبية (الهرم)')
        self.assertEqual(route['dir'], original['dir'])
        self.assertEqual(route['start_pt'], original['start_pt'])
        self.assertEqual(network['routes'][0]['dest_ar'], route['dest_ar'])
        self.assertEqual(network['trips'], [{'id': 'trip', 'calls': ['unchanged']}])

    def test_stop_labels_are_arabic_but_english_search_names_and_ids_survive(self):
        stops = [{'id': 's', 'name_ar': 'بنك QNB (شارع الهرم)', 'name_en': 'QNB Bank', 'lat': 30, 'lng': 31}]
        network = {'routes': [], 'stops': [{'id': 's', 'nameAr': stops[0]['name_ar'], 'nameEn': 'QNB Bank'}], 'trips': []}
        routes = [{'id': 'r', 'origin': 'Al Bassous', 'dest': 'Hamada Emam', 'via_stops': [stops[0]['name_ar']]}]
        names.localize(routes, stops, network)
        self.assertEqual(stops[0]['name_ar'], 'بنك كيو إن بي (شارع الهرم)')
        self.assertEqual(stops[0]['name_en'], 'QNB Bank')
        self.assertEqual(network['stops'][0]['nameAr'], stops[0]['name_ar'])
        snapshot = copy.deepcopy((routes, stops, network))
        names.localize(routes, stops, network)
        self.assertEqual((routes, stops, network), snapshot)

    def test_unknown_place_is_reported_instead_of_being_silently_mistranslated(self):
        with self.assertRaisesRegex(ValueError, 'Unknown place'):
            names.localize([{'id': 'r', 'origin': 'Unknown place', 'dest': 'Haram Talbeya'}], [], {'routes': [], 'stops': []})


if __name__ == '__main__':
    unittest.main()
