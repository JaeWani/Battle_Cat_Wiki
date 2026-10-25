import importlib.util
import pathlib
import unittest
p=pathlib.Path(__file__).resolve().parents[1]/'scripts/collect-events.py'
spec=importlib.util.spec_from_file_location('collector',p)
collector=importlib.util.module_from_spec(spec);spec.loader.exec_module(collector)
class OfficialPeriodTests(unittest.TestCase):
    def test_exact_period_and_inclusive_announced_minute(self):
        actual=collector.period('개최 기간 2026년 10월 23일(11:00) ~ 10월 26일(10:59) 예정!')
        self.assertEqual(actual['startAt'],'2026-10-23T11:00:00+09:00')
        self.assertEqual(actual['announcedEndAt'],'2026-10-26T10:59:00+09:00')
        self.assertEqual(actual['endAt'],'2026-10-26T11:00:00+09:00')
    def test_cross_year(self):
        actual=collector.period('2026년 12월 30일(11:00) ～ 1월 2일(23:59)')
        self.assertEqual(actual['announcedEndAt'],'2027-01-02T23:59:00+09:00')
        self.assertEqual(actual['endAt'],'2027-01-03T00:00:00+09:00')
    def test_explicit_end_year(self):
        self.assertEqual(collector.period('2026년 12월 30일(11:00) ~ 2027년 1월 2일(10:59)')['endAt'],'2027-01-02T11:00:00+09:00')
    def test_publication_date_cannot_create_a_calendar_period(self):
        self.assertIsNone(collector.period('2026.10.25 NEW 개최 중!'))
        self.assertIsNone(collector.period('2026년 10월 25일 공지. 기간은 게임 내 확인.'))
    def test_no_hours_are_invented_for_recurring_notices(self):
        self.assertIsNone(collector.period('매주 토요일, 일요일 각각 개최!'))
    def test_html_entity_and_nested_title(self):
        doc=collector.Parser('<a href="notices/1?x=1&amp;y=2"><p class="newstitle">고양이 <b>축제</b> &amp; 뽑기</p></a>').root
        node=doc.find(cls='newstitle')[0]
        self.assertEqual(collector.clean(node.text()),'고양이 축제 & 뽑기')
        self.assertEqual(node.ancestor('a').attrs['href'],'notices/1?x=1&y=2')
if __name__=='__main__':unittest.main()
