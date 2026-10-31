// Rough geography for scheduling, read from a team's city ("Austin, Texas",
// "Durham, N.C.", "Durham, NC"): the city itself when it's in the table below,
// otherwise the center of its state. Good enough to tell regional trips from
// long ones.

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
const BY_NAME = new Map(), CODE = new Map();
for (const [full, ap, code, lat, lng] of STATES) for (const k of [full, ap, code]) { BY_NAME.set(norm(k), [lat, lng]); CODE.set(norm(k), code); }
// Home cities, so distances inside a big state (Arcata to San Diego) are real.
// [city, state code, lat, lng]; other cities fall back to their state's center.
const CITIES = [
  ['Ann Arbor', 'MI', 42.28, -83.74], ['Auburn', 'AL', 32.61, -85.48], ['Austin', 'TX', 30.27, -97.74], ['Baton Rouge', 'LA', 30.45, -91.19],
  ['Bemidji', 'MN', 47.47, -94.88], ['Bloomington', 'IN', 39.17, -86.53], ['Boston', 'MA', 42.36, -71.06], ['Bowling Green', 'OH', 41.37, -83.65],
  ['Champaign', 'IL', 40.12, -88.24], ['Clemson', 'SC', 34.68, -82.84], ['College Station', 'TX', 30.63, -96.33], ['Columbia', 'MO', 38.95, -92.33],
  ['Columbus', 'OH', 39.96, -83.00], ['Conway', 'SC', 33.84, -79.05], ['Corvallis', 'OR', 44.56, -123.26], ['Davis', 'CA', 38.54, -121.74],
  ['DeKalb', 'IL', 41.93, -88.75], ['Detroit', 'MI', 42.33, -83.05], ['East Lansing', 'MI', 42.74, -84.48], ['Fargo', 'ND', 46.88, -96.79],
  ['Fullerton', 'CA', 33.87, -117.92], ['Gainesville', 'FL', 29.65, -82.32], ['Greeley', 'CO', 40.42, -104.71], ['Green Bay', 'WI', 44.52, -88.02],
  ['Harrisonburg', 'VA', 38.45, -78.87], ['Honolulu', 'HI', 21.31, -157.86], ['Houston', 'TX', 29.76, -95.37], ['Iowa City', 'IA', 41.66, -91.53],
  ['Kalamazoo', 'MI', 42.29, -85.59], ['Kansas City', 'MO', 39.10, -94.58], ['Kent', 'OH', 41.15, -81.36], ['Knoxville', 'TN', 35.96, -83.92],
  ['Lafayette', 'LA', 30.22, -92.02], ['Lincoln', 'NE', 40.81, -96.70], ['Logan', 'UT', 41.74, -111.83], ['Long Beach', 'CA', 33.77, -118.19],
  ['Los Angeles', 'CA', 34.05, -118.24], ['Louisville', 'KY', 38.25, -85.76], ['Lubbock', 'TX', 33.58, -101.85], ['Madison', 'WI', 43.07, -89.40],
  ['Mankato', 'MN', 44.16, -94.00], ['Milwaukee', 'WI', 43.04, -87.91], ['Minneapolis', 'MN', 44.98, -93.27], ['Missoula', 'MT', 46.87, -113.99],
  ['Mobile', 'AL', 30.69, -88.04], ['Moon Township', 'PA', 40.52, -80.21], ['Mount Pleasant', 'MI', 43.60, -84.77], ['Nashville', 'TN', 36.16, -86.78],
  ['Norman', 'OK', 35.22, -97.44], ['Orlando', 'FL', 28.54, -81.38], ['Oxford', 'MS', 34.37, -89.52], ['Raleigh', 'NC', 35.78, -78.64],
  ['Rochester', 'MI', 42.68, -83.13], ['Salt Lake City', 'UT', 40.76, -111.89], ['San Marcos', 'TX', 29.88, -97.94], ['Santa Barbara', 'CA', 34.42, -119.70],
  ['Seattle', 'WA', 47.61, -122.33], ['St. Cloud', 'MN', 45.56, -94.16], ['St. Louis', 'MO', 38.63, -90.20], ['St. Paul', 'MN', 44.95, -93.09],
  ['Stanford', 'CA', 37.43, -122.17], ['Starkville', 'MS', 33.45, -88.82], ['Stillwater', 'OK', 36.12, -97.06], ['Tempe', 'AZ', 33.43, -111.94],
  ['Terre Haute', 'IN', 39.47, -87.41], ['Tucson', 'AZ', 32.22, -110.97], ['West Haven', 'CT', 41.27, -72.95], ['Whitewater', 'WI', 42.83, -88.73],
  ['Atlanta', 'GA', 33.75, -84.39], ['Durham', 'NC', 35.99, -78.90], ['Claremore', 'OK', 36.31, -95.62], ['Akron', 'OH', 41.08, -81.52],
  ['Oklahoma City', 'OK', 35.47, -97.52], ['Berkeley', 'CA', 37.87, -122.27], ['Eugene', 'OR', 44.05, -123.09], ['Fresno', 'CA', 36.74, -119.79],
  ['Phoenix', 'AZ', 33.45, -112.07], ['Reno', 'NV', 39.53, -119.81], ['Hillsboro', 'OR', 45.52, -122.99], ['Portland', 'OR', 45.52, -122.68],
  ['Sacramento', 'CA', 38.58, -121.49], ['San Diego', 'CA', 32.72, -117.16], ['San Jose', 'CA', 37.34, -121.89], ['Las Vegas', 'NV', 36.17, -115.14],
  ['Bakersfield', 'CA', 35.37, -119.02], ['Riverside', 'CA', 33.95, -117.40], ['San Luis Obispo', 'CA', 35.28, -120.66], ['Northridge', 'CA', 34.23, -118.54],
  ['Stockton', 'CA', 37.96, -121.29], ['Santa Clara', 'CA', 37.35, -121.96], ['La Jolla', 'CA', 32.84, -117.27], ['Arcata', 'CA', 40.87, -124.08],
  ['Carson', 'CA', 33.83, -118.28], ['Hayward', 'CA', 37.67, -122.08], ['Seaside', 'CA', 36.61, -121.85], ['San Bernardino', 'CA', 34.11, -117.29],
  ['San Marcos', 'CA', 33.14, -117.17], ['Chico', 'CA', 39.73, -121.84], ['San Francisco', 'CA', 37.77, -122.42], ['Turlock', 'CA', 37.49, -120.85],
  ['Ellensburg', 'WA', 46.99, -120.55], ['Monmouth', 'OR', 44.85, -123.23], ['Bellingham', 'WA', 48.75, -122.48], ['Azusa', 'CA', 34.13, -117.91],
  ['La Mirada', 'CA', 33.92, -118.01], ['Irvine', 'CA', 33.68, -117.83], ['San Rafael', 'CA', 37.97, -122.53], ['Lincoln', 'CA', 38.89, -121.29],
  ['Atherton', 'CA', 37.46, -122.20], ['Costa Mesa', 'CA', 33.64, -117.92], ['Moraga', 'CA', 37.83, -122.13], ['Hilo', 'HI', 19.72, -155.09],
  ['Lacey', 'WA', 47.03, -122.82], ['Kaneohe', 'HI', 21.40, -157.80],
];
const BY_CITY = new Map(CITIES.map(([c, st, lat, lng]) => [`${norm(c)}|${st}`, [lat, lng]]));

// [lat, lng] for a city like "Austin, Texas", or null if the state isn't recognized.
export function cityPoint(city) {
  if (!city || !city.includes(',')) return null;
  const st = norm(city.split(',').pop()), name = norm(city.slice(0, city.lastIndexOf(',')));
  return BY_CITY.get(`${name}|${CODE.get(st)}`) || BY_NAME.get(st) || null;
}

// Great-circle distance in miles.
export function miles(p, q) {
  if (!p || !q) return null;
  const rad = d => (d * Math.PI) / 180;
  const a = Math.sin(rad(q[0] - p[0]) / 2) ** 2 + Math.cos(rad(p[0])) * Math.cos(rad(q[0])) * Math.sin(rad(q[1] - p[1]) / 2) ** 2;
  return 3959 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}
