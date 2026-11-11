const cache = new Map();
export function loadJSON(url) {
  if (!cache.has(url))
    cache.set(
      url,
      fetch(new URL(url, document.baseURI))
        .then((response) => {
          if (!response.ok)
            throw new Error(`資料載入失敗：${url} (${response.status})`);
          if (!response.headers.get("content-type")?.includes("application/json"))
            throw new Error(`資料格式錯誤：${url}（伺服器未回傳 JSON）`);
          return response.json();
        })
        .catch((error) => {
          cache.delete(url);
          throw error.message.includes(url) ? error : new Error(`資料載入失敗：${url} · ${error.message}`, { cause: error });
        }),
    );
  return cache.get(url);
}
