const directCities = new Set(["63000", "64000", "65000", "66000", "67000", "68000"]);

function aggregate(rows, candidates) {
  const sum = (field) => rows.reduce((total, row) => total + row[field], 0);
  const valid = sum("total");
  const eligible = sum("eligible");
  return {
    units: rows.length,
    valid,
    turnout: eligible > 0 ? 100 * sum("cast") / eligible : null,
    candidates: candidates.map(({ name, party }) => {
      const votes = rows.reduce((total, row) => total + (row.candidates.find((entry) => entry.name === name)?.votes || 0), 0);
      return { name, party, votes, share: valid > 0 ? 100 * votes / valid : null };
    }),
  };
}

export function homeFindings(national, towns, history, counties) {
  const townRows = towns.map(([, row]) => row);
  const cities = townRows.filter((row) => directCities.has(row.county) && row.name.endsWith("區"));
  const villages = townRows.filter((row) => !directCities.has(row.county) && row.name.endsWith("鄉"));
  const prior = history.elections.find((row) => row.year === 2020);
  const current = history.elections.find((row) => row.year === 2024);
  if (!prior || !current || current.validVotes !== national.total)
    throw new Error("首頁跨屆比較需與 2024 全國有效票一致。");

  const rounds = [prior, current];
  const parties = [...new Set(rounds.flatMap((row) => row.candidates.map((candidate) => candidate.party)))];
  const partyResults = parties.map((party) => ({
    party,
    rates: rounds.map((row) => {
      const candidates = row.candidates.filter((candidate) => candidate.party === party);
      if (!candidates.length) return null;
      return 100 * candidates.reduce((sum, candidate) => sum + candidate.votes, 0) / row.validVotes;
    }),
  }));
  const balanced = townRows.reduce((best, row) => {
    const score = row.candidates.reduce((sum, c) => sum + (c.votes / row.total - 1 / 3) ** 2, 0);
    return !best || score < best.score ? { score, row } : best;
  }, null);
  const countyA = counties.elections.find(row => row.year === 2020).units;
  const countyB = counties.elections.find(row => row.year === 2024).units;
  const dppShare = row => 100 * row.candidates.filter(c => c.party === "民主進步黨").reduce((sum, c) => sum + c.votes, 0) / row.validVotes;
  const largestChange = Object.entries(countyB).map(([code, row]) => ({
    code, name: row.name, before: dppShare(countyA[code]), after: dppShare(row),
  })).sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))[0];
  const largest = Object.values(countyB).sort((a, b) => b.validVotes - a.validVotes).slice(0, 5);
  return {
    questions: {
      balanced: { county: balanced.row.county, town: balanced.row.town, name: balanced.row.name },
      topFive: 100 * largest.reduce((sum, row) => sum + row.validVotes, 0) / national.total,
      largestChange,
    },
    place: {
      cities: aggregate(cities, national.candidates),
      villages: aggregate(villages, national.candidates),
      excluded: townRows.length - cities.length - villages.length,
    },
    change: {
      years: rounds.map(({ year }) => year),
      turnout: rounds.map(({ cast, eligible }) => 100 * cast / eligible),
      partyResults,
    },
  };
}
