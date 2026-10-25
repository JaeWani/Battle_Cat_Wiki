import importlib.util
from pathlib import Path
import unittest
p=Path(__file__).resolve().parents[1]/'scripts/collect-stages.py'
spec=importlib.util.spec_from_file_location('stages',p)
stages=importlib.util.module_from_spec(spec);spec.loader.exec_module(stages)
URL='https://ponosgames.com/information/appli/battlecats/stage/kr/S406.html'
HTML='''<h2>공식 맵<span id="clear_flag"><img src="clear.png"></span></h2>
<div id="stage0_block" style="display:none"><span class="stage">첫 스테이지</span><table>
<tr><th>필요 통솔력</th><td>200</td></tr><tr><th>난이도</th><td>★10</td></tr>
<tr><th>드롭 보상</th><td>레어 티켓 1장 <span class="nodrop">미획득</span><span class="drop">획득</span></td></tr>
<tr><th>출현하는 적</th><td><div id="stage0_enemy_list_1">
<img src="img/enemy/enemy_icon_046.png"><img src="img/enemy/enemy_icon_046.png"><img src="img/enemy/enemy_icon_001.png">
<img src="https://example.com/enemy_icon_999.png"></div><div id="stage0_enemy_list_0"><img src="img/enemy/icon_hatena.png"></div></td></tr></table></div>'''
class OfficialStageTests(unittest.TestCase):
    def parse(self,html=HTML):return stages.parse_stage_page(html.encode(),URL)
    def test_only_official_distinct_enemy_icons_no_inferred_counts(self):
        s=self.parse()['stages'][0]
        self.assertEqual([e['iconCode'] for e in s['enemies']],['046','001'])
        for e in s['enemies']:
            for key in ['name','magnification','spawnCount','spawnTime']:self.assertIsNone(e[key])
    def test_reward_does_not_copy_player_state(self):
        s=self.parse()['stages'][0]
        self.assertEqual(s['energy'],200);self.assertEqual(s['difficulty'],'★10')
        self.assertEqual(s['rewards'],'레어 티켓 1장')
    def test_hidden_stage_metadata_is_preserved_but_unknown_list_not_fabricated(self):
        s=self.parse(HTML.replace('stage0_enemy_list_1','unpublished'))['stages'][0]
        self.assertEqual(s['name'],'첫 스테이지');self.assertFalse(s['enemyListPublished']);self.assertEqual(s['enemies'],[])
    def test_reject_nonofficial_page(self):
        with self.assertRaises(ValueError):stages.parse_stage_page(HTML.encode(),'https://example.com/S406.html')
if __name__=='__main__':unittest.main()
