const cache = new Map();
export function loadJSON(url) {
  if (!cache.has(url))
    cache.set(
      url,
      fetch(url)
        .then((response) => {
          if (!response.ok)
            throw new Error(`資料載入失敗：${url} (${response.status})`);
          return response.json();
        })
        .catch((error) => {
          cache.delete(url);
          throw error;
        }),
    );
  return cache.get(url);
}
