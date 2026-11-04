from fixtures import artifact
import csv,json
from pathlib import Path
# Use the explicit exported village file, independent of UI percentages.
p=artifact('臺灣2024-松山區-村里.csv')
rows=list(csv.DictReader(p.open(encoding='utf-8-sig')))
assert len(rows)==99 and sum(int(r['票數']) for r in rows)==117322
print('PASS: 33 village units / 99 candidate rows / 117,322 votes')
