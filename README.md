# 臺灣選舉觀測

桌面選舉資料視覺化工作台，使用2024總統及第11屆立委結果。網址：http://127.0.0.1:4173

## 本地啟動

Windows可雙擊`Start-Local.cmd`，自動啟動本地服務並開啟瀏覽器；重複開啟會沿用同一服務。需要Python 3，網站執行不需額外套件。也可執行`python scripts/start_local.py --no-browser`，只啟動服務。

在此目錄執行 `python scripts/serve.py --port 4173`，再以桌面瀏覽器開啟上述網址。資料與圖形程式均存放本機，不需要帳號或資料庫。修改樣式或 JavaScript 後執行 `python scripts/build_static.py` 更新樣式與快取版本。

## 功能

地理圖可縮放、搜尋及選取；另有等格圖、按票數計算面積的氣泡、三方圖、並列地圖、蜂群和可配置散點。總統選舉支援框選、條件篩選、雙視圖、加權合計、地區比較和選票貢獻分析。立委支援73區域選區及2024年當選的完整113席。網址記錄分析狀態；CSV、SVG、PNG提供明確範圍與來源。

## 資料與限制

選票與當選資料來自中央選舉委員會原始CSV；[官方當選公告](https://web.cec.gov.tw/central/article/41421)與[選區範圍](https://data.gov.tw/dataset/170247)。總統行政區使用 Taiwan Atlas 作定位。區域立委地圖將2024村里歸屬與[官方2023年歷史村里圖資](https://data.gov.tw/dataset/130549)合併為73個投票村里範圍，是簡化後的資料呈現，並非法定測量界線。離島分幅比例不同。投開票所範圍與歷史鄉鎮、村里對應尚未確認，沒有據此推估。歷史縣市依內政部整個縣市改制沿革統一22個統計範圍；2010年前臺中、臺南、高雄縣市先加總，再計算比率。現今縣市形狀僅作示意，不冒充歷史測量界線。

## 驗證與後續

`python scripts/verify_all.py` 檢查選票、席次、選區連結與簡化邊界；`python scripts/verify-prototype.py` 檢查框選合計和氣泡面積。資料清查、桌面驗收及尚未完成的歷史比較工作見 [修改项目表](docs/修改项目表.md)。

另有1996–2024八屆總統全國及統一縣市分析，含歷史矩陣、雙年差值與縣市走勢。2024總統與73區域立委均可進入村里細查；特殊或合併統計組只列結果，不估計範圍。多尺度統計分開呈現地區等權分布與加總票數後比率。票席結構保留四類立委選票各自分母，名單當選人的政黨票與個人票分開。

「歷史選舉 → 縣市歷史」亦有2008–2024五屆立委政黨票、2014／2018／2022縣市長，可切換矩陣、同尺度雙年地圖、擦除比較、走勢與共同縣市空間關聯。縣市長不合併不同地方選舉的候選人；2022嘉義市重行選舉缺資料，政黨未提名保留NA。空間關聯固定共同可用集合及Rook拓撲，不補造離島鄰接。150組中央／地方原始結果另在資料室按需查詢，保留來源狀態、舊行政碼和公告校正。

資料更新時，依需要執行prepare_villages.py、prepare_legislator_villages.py、prepare_district_membership.py、history_counties.py和parliament.py，最後執行metadata.py、build_static.py。這些整理腳本需要原始CSV保留在來源目錄；直接本地預覽不需重新整理資料。parliament.py同時重建四類票席資料。

歷史資料流程：archive.py整理原始選區，archive_evidence.py保留官方日期及公告校正；history_elections.py建立縣市長／政黨票系列；history_adjacency.py由已核驗鄉鎮共邊產生固定縣市拓撲。verify_history_series.py獨立重讀原始CSV核票數、分母和SHA256，verify_history_browser.py及verify_history_spatial.py核對原生瀏覽器紀錄，verify_history_publication.py檢查實際下載。歷史鄉鎮村里及區域立委的地理對應仍需逐項官方證據，不能僅按同名同碼直接比較。

新增統計核驗：verify_multiscale.py、verify_vote_seats.py；瀏覽器實際下載的測試CSV路徑記錄於對應docs驗收JSON。尚未完成項目與最新證據以docs/新版深度审计项目表.md為準。
