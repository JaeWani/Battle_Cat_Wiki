"""Build character talent choices from the same pinned numerical dataset as the catalog.
Usage: python scripts/import-profile-options.py /path/to/battlecats-data
"""
import csv, json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
meta = json.loads((ROOT / 'public/data/meta.json').read_text())
rows = list(csv.DictReader((source / 'data/cat.tsv').open(encoding='utf-8'), delimiter='\t'))
names = [None, '공격력 다운', '움직임을 멈춘다', '움직임을 느리게 한다', '공격 대상 한정', '엄청 강하다', '맷집이 좋다', '초 데미지', '날려버린다', '워프', '공격력 업', '살아남는다', '성 파괴', '크리티컬', '좀비 킬러', '배리어 브레이커', '돈을 많이 받는다', '파동', '공격력 다운 내성', '멈추기 내성', '느리게 내성', '날려버리기 내성', '파동 내성', '파동 스톱퍼', '워프 내성', '생산 비용 감소', '재생산 시간 단축', '이동 속도 업', '넉백 수 증가', '고대의 저주 무효', '고대의 저주 내성', '기본 공격력 업', '기본 체력 업', '빨간 적 대상', '떠있는 적 대상', '검은 적 대상', '메탈 적 대상', '천사 대상', '에이리언 대상', '좀비 대상', '고대종 대상', '속성이 없는 적 대상', '마녀 대상', '사도 대상', '공격력 다운 무효', '멈추기 무효', '느리게 무효', '날려버리기 무효', '파동 무효', '워프 무효', '혼신의 일격', '공격 무효', '독 공격 내성', '독 공격 무효', '열파 내성', '열파 무효', '열파', '악마 대상', '쉴드 브레이커', '영혼 공격', '저주', '공격 간격 단축', '소파동', '초생명체 특효', '초수 특효', '소열파', '초현자 특효', '폭파', '열파 반사', '폭파 무효', '기본 공격력 업+', '기본 체력 업+', '생산 시간 단축']
units = []
for ident, row in enumerate(rows):
    raw = list(map(int, row['talents'].split('|'))) if row['talents'] else []
    talents = []
    for offset in range(1, min(155, len(raw)), 14):
        kind = raw[offset]
        if not kind:
            break
        if offset + 13 >= len(raw) or kind >= len(names):
            raise ValueError(f'Unknown talent layout: {ident}')
        talents.append({'id': kind, 'name': names[kind], 'maxLevel': raw[offset + 1] or 1, 'super': raw[offset + 13] == 1})
    units.append({'id': ident, 'talents': talents})
out = {'repository': meta['repository'], 'commit': meta['commit'], 'units': units}
(ROOT / 'public/data/profile-options.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'{len(units)} characters; {sum(bool(u["talents"]) for u in units)} with talent choices')
