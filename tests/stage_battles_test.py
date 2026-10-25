import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('battle_builder',Path(__file__).resolve().parents[1]/'scripts/build-stage-battles.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
class BattleParserTests(unittest.TestCase):
 def test_base36_defaults_and_separate_magnifications(self):
  self.assertEqual(builder.parse_line('0,,0,60,120,100,0,'),dict(enemyId=0,hpPercent=100,attackPercent=100,crownApplies=True))
  self.assertEqual(builder.parse_line('bb,1,0,,,99,1,5k+b4'),dict(enemyId=407,hpPercent=200,attackPercent=400,crownApplies=True))
 def test_castle_flag(self):
  self.assertFalse(builder.parse_line('0,1,0,,,100,00,2s')['crownApplies'])
 def test_bad_source_row_rejected(self):
  with self.assertRaises(ValueError):builder.parse_line('0,1')
  with self.assertRaises(ValueError):builder.parse_line('0,1,0,,,100,0,0')
