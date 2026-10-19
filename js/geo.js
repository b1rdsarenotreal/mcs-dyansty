// Rough geography for scheduling: each state's approximate center, read from
// a team's city ("Austin, Texas", "Durham, N.C.", "Durham, NC"). Good enough
// to tell regional trips from cross-country ones.

// [lat, lng], with the full name, AP abbreviation and postal code.
const STATES = [
  ['Alabama', 'Ala.', 'AL', 32.8, -86.8], ['Alaska', 'Alaska', 'AK', 61.4, -152.3], ['Arizona', 'Ariz.', 'AZ', 34.2, -111.7],
  ['Arkansas', 'Ark.', 'AR', 34.9, -92.4], ['California', 'Calif.', 'CA', 36.8, -119.4], ['Colorado', 'Colo.', 'CO', 39.0, -105.5],
  ['Connecticut', 'Conn.', 'CT', 41.6, -72.7], ['Delaware', 'Del.', 'DE', 39.0, -75.5], ['District of Columbia', 'D.C.', 'DC', 38.9, -77.0],
  ['Florida', 'Fla.', 'FL', 28.6, -82.4], ['Georgia', 'Ga.', 'GA', 32.7, -83.4], ['Hawaii', 'Hawaii', 'HI', 20.8, -156.3],
  ['Idaho', 'Idaho', 'ID', 44.4, -114.6], ['Illinois', 'Ill.', 'IL', 40.0, -89.2], ['Indiana', 'Ind.', 'IN', 39.9, -86.3],
  ['Iowa', 'Iowa', 'IA', 42.1, -93.5], ['Kansas', 'Kan.', 'KS', 38.5, -98.4], ['Kentucky', 'Ky.', 'KY', 37.5, -85.3],
  ['Louisiana', 'La.', 'LA', 31.1, -92.0], ['Maine', 'Maine', 'ME', 45.4, -69.2], ['Maryland', 'Md.', 'MD', 39.0, -76.8],
  ['Massachusetts', 'Mass.', 'MA', 42.3, -71.8], ['Michigan', 'Mich.', 'MI', 43.3, -84.5], ['Minnesota', 'Minn.', 'MN', 45.7, -93.9],
  ['Mississippi', 'Miss.', 'MS', 32.7, -89.7], ['Missouri', 'Mo.', 'MO', 38.5, -92.5], ['Montana', 'Mont.', 'MT', 46.9, -110.4],
  ['Nebraska', 'Neb.', 'NE', 41.5, -99.8], ['Nevada', 'Nev.', 'NV', 39.3, -116.6], ['New Hampshire', 'N.H.', 'NH', 43.7, -71.6],
  ['New Jersey', 'N.J.', 'NJ', 40.2, -74.7], ['New Mexico', 'N.M.', 'NM', 34.4, -106.1], ['New York', 'N.Y.', 'NY', 42.9, -75.5],
  ['North Carolina', 'N.C.', 'NC', 35.6, -79.4], ['North Dakota', 'N.D.', 'ND', 47.5, -100.5], ['Ohio', 'Ohio', 'OH', 40.3, -82.8],
  ['Oklahoma', 'Okla.', 'OK', 35.6, -97.5], ['Oregon', 'Ore.', 'OR', 44.0, -120.6], ['Pennsylvania', 'Pa.', 'PA', 40.9, -77.8],
  ['Rhode Island', 'R.I.', 'RI', 41.7, -71.5], ['South Carolina', 'S.C.', 'SC', 33.9, -80.9], ['South Dakota', 'S.D.', 'SD', 44.4, -100.2],
  ['Tennessee', 'Tenn.', 'TN', 35.9, -86.4], ['Texas', 'Texas', 'TX', 31.5, -98.5], ['Utah', 'Utah', 'UT', 39.3, -111.7],
  ['Vermont', 'Vt.', 'VT', 44.1, -72.7], ['Virginia', 'Va.', 'VA', 37.5, -78.9], ['Washington', 'Wash.', 'WA', 47.4, -120.5],
  ['West Virginia', 'W.Va.', 'WV', 38.6, -80.6], ['Wisconsin', 'Wis.', 'WI', 44.6, -89.9], ['Wyoming', 'Wyo.', 'WY', 43.0, -107.6],
];
const norm = x => String(x || '').toLowerCase().replace(/[.\s]/g, '');
const BY_NAME = new Map();
for (const [full, ap, code, lat, lng] of STATES) for (const k of [full, ap, code]) BY_NAME.set(norm(k), [lat, lng]);

// [lat, lng] for a city like "Austin, Texas", or null if the state isn't recognized.
export function cityPoint(city) {
  if (!city || !city.includes(',')) return null;
  return BY_NAME.get(norm(city.split(',').pop())) || null;
}

// Great-circle distance in miles.
export function miles(p, q) {
  if (!p || !q) return null;
  const rad = d => (d * Math.PI) / 180;
  const a = Math.sin(rad(q[0] - p[0]) / 2) ** 2 + Math.cos(rad(p[0])) * Math.cos(rad(q[0])) * Math.sin(rad(q[1] - p[1]) / 2) ** 2;
  return 3959 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}
