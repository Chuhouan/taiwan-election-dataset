from fixtures import artifact
import csv
from pathlib import Path
p=artifact('臺灣2024-不分區當選名單.csv');rows=list(csv.DictReader(p.open(encoding='utf-8-sig')));assert len(rows)==34 and all(x['席次類別']=='不分區' for x in rows);print('PASS: 34 list-seat members exported')
