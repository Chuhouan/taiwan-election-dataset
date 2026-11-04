import { test, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { crc32, zipFiles } from "../../src/core/zip.js";
test("CRC-32 matches the published standard check value", () => expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926));
test("an independent Python ZIP reader recovers UTF-8 filenames and contents", () => {
  const bytes = zipFiles([{ name: "臺灣.svg", data: "<svg>中文</svg>" }, { name: "metadata.json", data: '{"count":24}' }]);
  const result = execFileSync(process.platform === "win32" ? "python" : "python3",
    ["-X", "utf8", "-c", "import sys,zipfile,io,json;z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()));print(json.dumps({n:z.read(n).decode('utf8') for n in z.namelist()}))"], { input: bytes, encoding: "utf8" });
  expect(JSON.parse(result)).toEqual({ "臺灣.svg": "<svg>中文</svg>", "metadata.json": '{"count":24}' });
});
