# 選舉地圖志 / Taiwan Ballot Atlas

繁體中文選舉資料視覺原型。使用原始中選會 CSV；不需要伺服器資料庫或 API 金鑰。

## 本地執行

在此目錄執行 `python -m http.server 4173 --bind 127.0.0.1 --directory dist`，開啟 http://127.0.0.1:4173。

`python scripts/prepare.py` 從相鄰的 `../votedata/votedata` 原始資料目錄重建 dist/data.json 並驗證全國票數、22縣市、鄉鎮加總及73選區。原始檔保留於使用者資料夾，未複製進網站。

## 收錄

- 2024總統：全國、22縣市、368鄉鎮市區；號次及當選標記取自原檔。
- 2024區域立委：73選區完整候選人及當選席次；不含原住民、不分區。地圖僅行政區定位，尚未核實2024選區界線。
- 2022縣市長：22縣市及其鄉鎮細分，嘉義市另以2022-12-18重行選舉193個投開票所結果補齊。
- 勝負、領先差距、投票率，搜尋、CSV下載、鍵盤操作、地區深連結、資料方法彈窗。

## 資料與授權

選舉來源：https://data.gov.tw/dataset/13119 （政府資料開放授權條款第1版）。全國總統候選人票數另核對 https://www.cec.gov.tw/english/article/41410 。

地理資料：taiwan-atlas@0.0.2 towns-10t.json，內政部行政區界線衍生資料。上游 MIT 授權見 dist/vendor/taiwan-atlas-LICENSE.txt。固定版本圖資只作地理定位，不代表選舉當日法定界線。離島分幅，比例不同。

瀏覽器函式庫：D3 7.9.0（ISC）與 topojson-client 3.1.0（ISC），於 vendor 本地提供。字型為 Google Fonts Noto Sans TC / Noto Serif TC（SIL OFL），連線失敗使用系統中文字型。

設計研究與驗證記錄見 docs/design-research.md。本輯僅2022/2024三類選舉，其餘年份在時間軸上為不可操作的典藏提示。
