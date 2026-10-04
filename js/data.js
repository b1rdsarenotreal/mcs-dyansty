// Starting league: the 2016 teams, conferences and head coaches. Colors are
// each school's real colors; OFF / PIT / DEF are starting ratings (40–99).

export const START_YEAR = 2016;

export const CONFERENCES = {
  'Big 12':   { abbr: 'B12', color: '#B3261E' },
  'Big Ten':  { abbr: 'B1G', color: '#0088CE' },
  'Big West': { abbr: 'BW',  color: '#0E7C86' },
  'Horizon':  { abbr: 'HL',  color: '#E87722' },
  'MAC':      { abbr: 'MAC', color: '#00843D' },
  'Sun Belt': { abbr: 'SBC', color: '#C99700' },
};

// [school, conference, abbr, mascot, color, altColor, OFF, PIT, DEF]
const T = [
  ['Missouri', 'Big 12', 'MIZ', 'Tigers', '#000000', '#F1B82D', 75, 77, 74],
  ['Northern Colorado', 'Big 12', 'UNCO', 'Bears', '#013C65', '#F6B000', 62, 63, 61],
  ['Oklahoma', 'Big 12', 'OU', 'Sooners', '#841617', '#FDF9D8', 89, 86, 84],
  ['Texas', 'Big 12', 'TEX', 'Longhorns', '#BF5700', '#FFFFFF', 84, 88, 83],
  ['Texas A&M', 'Big 12', 'TAMU', 'Aggies', '#500000', '#FFFFFF', 82, 82, 81],
  ['Texas Tech', 'Big 12', 'TTU', 'Red Raiders', '#CC0000', '#000000', 78, 76, 76],
  ['Indiana', 'Big Ten', 'IND', 'Hoosiers', '#990000', '#EEEDEB', 70, 71, 70],
  ['Iowa', 'Big Ten', 'IOWA', 'Hawkeyes', '#000000', '#FFCD00', 69, 68, 68],
  ['Michigan', 'Big Ten', 'MICH', 'Wolverines', '#00274C', '#FFCB05', 81, 82, 79],
  ['Michigan State', 'Big Ten', 'MSU', 'Spartans', '#18453B', '#FFFFFF', 66, 67, 67],
  ['Minnesota', 'Big Ten', 'MINN', 'Golden Gophers', '#7A0019', '#FFCC33', 74, 77, 73],
  ['Nebraska', 'Big Ten', 'NEB', 'Cornhuskers', '#E41C38', '#FDF2D9', 77, 76, 75],
  ['Ohio State', 'Big Ten', 'OSU', 'Buckeyes', '#BB0000', '#666666', 73, 72, 74],
  ['Wisconsin', 'Big Ten', 'WIS', 'Badgers', '#C5050C', '#FFFFFF', 67, 68, 66],
  ['Arizona', 'Big West', 'ARIZ', 'Wildcats', '#0C234B', '#AB0520', 85, 81, 82],
  ['Arizona State', 'Big West', 'ASU', 'Sun Devils', '#8C1D40', '#FFC627', 78, 77, 76],
  ['Cal State Fullerton', 'Big West', 'CSUF', 'Titans', '#00274C', '#FF7900', 75, 78, 78],
  ['Long Beach State', 'Big West', 'LBSU', 'Beach', '#000000', '#F0B323', 72, 73, 72],
  ['Stanford', 'Big West', 'STAN', 'Cardinal', '#8C1515', '#FFFFFF', 79, 81, 80],
  ['UC Santa Barbara', 'Big West', 'UCSB', 'Gauchos', '#003660', '#FEBC11', 68, 70, 68],
  ['UCLA', 'Big West', 'UCLA', 'Bruins', '#2D68C4', '#F2A900', 87, 85, 86],
  ['Bemidji State', 'Horizon', 'BSU', 'Beavers', '#005A43', '#FFFFFF', 53, 54, 53],
  ['Detroit Mercy', 'Horizon', 'UDM', 'Titans', '#A6192E', '#002D72', 58, 59, 58],
  ['Green Bay', 'Horizon', 'GB', 'Phoenix', '#006A4E', '#FFFFFF', 63, 64, 62],
  ['Milwaukee', 'Horizon', 'MILW', 'Panthers', '#000000', '#FFBD00', 62, 62, 62],
  ['Minnesota State', 'Horizon', 'MNSU', 'Mavericks', '#4E2683', '#FFC72C', 59, 62, 58],
  ['Oakland', 'Horizon', 'OAK', 'Golden Grizzlies', '#000000', '#B59A57', 64, 65, 63],
  ['Robert Morris', 'Horizon', 'RMU', 'Colonials', '#14234B', '#A6192E', 61, 60, 60],
  ['St. Cloud State', 'Horizon', 'SCSU', 'Huskies', '#B7121F', '#000000', 57, 58, 57],
  ['St. Thomas', 'Horizon', 'STMN', 'Tommies', '#510C76', '#97999B', 60, 61, 60],
  ['UW–Whitewater', 'Horizon', 'UWW', 'Warhawks', '#44156A', '#FFFFFF', 55, 56, 55],
  ['Central Michigan', 'MAC', 'CMU', 'Chippewas', '#6A0032', '#FFC82E', 66, 67, 65],
  ['Kent State', 'MAC', 'KENT', 'Golden Flashes', '#002664', '#EAAB00', 65, 66, 65],
  ['North Dakota State', 'MAC', 'NDSU', 'Bison', '#0A5640', '#FFC72A', 64, 66, 63],
  ['Northern Illinois', 'MAC', 'NIU', 'Huskies', '#C8102E', '#000000', 63, 62, 62],
  ['UMKC', 'MAC', 'UMKC', 'Roos', '#004B87', '#FFC72C', 57, 58, 57],
  ['Western Michigan', 'MAC', 'WMU', 'Broncos', '#6C4023', '#B5A167', 61, 62, 61],
  ['Central Florida', 'Sun Belt', 'UCF', 'Knights', '#000000', '#BA9B37', 74, 75, 73],
  ['Coastal Carolina', 'Sun Belt', 'CCU', 'Chanticleers', '#006F71', '#A27752', 72, 70, 71],
  ['Florida', 'Sun Belt', 'FLA', 'Gators', '#0021A5', '#FA4616', 86, 88, 85],
  ['Houston', 'Sun Belt', 'HOU', 'Cougars', '#C8102E', '#FFFFFF', 71, 72, 72],
  ['James Madison', 'Sun Belt', 'JMU', 'Dukes', '#450084', '#CBB677', 73, 74, 71],
  ['LSU', 'Sun Belt', 'LSU', 'Tigers', '#461D7C', '#FDD023', 84, 85, 83],
  ['Saint Louis', 'Sun Belt', 'SLU', 'Billikens', '#003DA5', '#FFFFFF', 63, 64, 63],
  ['Texas State', 'Sun Belt', 'TXST', 'Bobcats', '#501214', '#8D734A', 70, 71, 70],
];

// Names the logo list may know a school by.
export const LOGO_ALIASES = { 'Central Florida': 'UCF', 'UMKC': 'Kansas City', 'UW–Whitewater': 'Wisconsin-Whitewater' };

// Head coaches for the first season (editable in the app).
export const COACHES = {
  'Missouri': 'Ehren Earleywine',
  'Northern Colorado': 'Travis Owen',
  'Oklahoma': 'JT Gasso',
  'Texas': 'Craig Snider',
  'Texas A&M': 'Gerry Glasco',
  'Texas Tech': 'Ruben Felix',
  'Indiana': 'Mike Perniciaro',
  'Iowa': 'Tim Keirnan',
  'Michigan': 'Bonnie Tholl',
  'Michigan State': 'Scot Thomas',
  'Minnesota': 'Derek Mayson',
  'Nebraska': 'Darren Mueller',
  'Ohio State': 'Troy Whitt',
  'Wisconsin': 'Randy Schneider',
  'Arizona': 'Caitlin Lowe',
  'Arizona State': 'Robert Wagner',
  'Cal State Fullerton': 'Jorge Araujo',
  'Long Beach State': 'Landy Rodriguez',
  'Stanford': 'Matthew Ratliff',
  'UC Santa Barbara': 'Michael Johnson',
  'UCLA': 'Kirk Walker',
  'Bemidji State': 'Rick Supinski',
  'Detroit Mercy': 'Marcus Tan',
  'Green Bay': 'Roman Foore',
  'Milwaukee': 'Nate Devine',
  'Minnesota State': 'Tim Keirnan',
  'Oakland': 'Jay Miller',
  'Robert Morris': 'Craig Coleman',
  'St. Cloud State': 'Greg Hicks',
  'St. Thomas': 'Jim Tschida',
  'UW–Whitewater': 'Bryson DuCharme',
  'Central Michigan': 'Nickey McCurry',
  'Kent State': 'Kyle Gross',
  'North Dakota State': 'Darren Muelle',
  'Northern Illinois': 'Mike Steuerwald',
  'UMKC': 'Kristopher Walushka',
  'Western Michigan': 'Andrew Kirkpatrick',
  'Central Florida': 'Tommy Santiago',
  'Coastal Carolina': 'Ronald Hackeatt',
  'Florida': 'Cody Dent',
  'Houston': 'JD Artega',
  'James Madison': 'Brandon Cohen',
  'LSU': 'Howard Dobson',
  'Saint Louis': 'Avon Meacham',
  'Texas State': 'Douglas Allin',
};

export function makeTeam({ school, conference, abbr, mascot = '', coach = '', coachId = null, color = '#555555', altColor = '#dddddd', off = 65, pit = 65, def = 65 }) {
  return {
    school, conference, abbr: abbr || school.replace(/[^A-Za-z ]/g, '').split(/\s+/).map(w => w[0]).join('').slice(0, 4).toUpperCase(),
    mascot, coach, coachId, color, altColor, off, pit, def, base: { off, pit, def }, logoOverride: null,
  };
}

export function seedTeams() {
  const teams = {};
  for (const [school, conference, abbr, mascot, color, altColor, off, pit, def] of T) {
    teams[school] = makeTeam({ school, conference, abbr, mascot, coach: COACHES[school] || '', color, altColor, off, pit, def });
  }
  return teams;
}
