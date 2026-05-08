export type NFLTeam = {
  abbr: string;
  city: string;
  name: string;
  fullName: string;
  espnId: string;
  conference: 'AFC' | 'NFC';
  division: 'East' | 'North' | 'South' | 'West';
};

export const NFL_TEAMS: NFLTeam[] = [
  // AFC East
  { abbr: 'BUF', city: 'Buffalo',        name: 'Bills',       fullName: 'Buffalo Bills',           espnId: '2',  conference: 'AFC', division: 'East' },
  { abbr: 'MIA', city: 'Miami',          name: 'Dolphins',    fullName: 'Miami Dolphins',           espnId: '15', conference: 'AFC', division: 'East' },
  { abbr: 'NE',  city: 'New England',    name: 'Patriots',    fullName: 'New England Patriots',     espnId: '17', conference: 'AFC', division: 'East' },
  { abbr: 'NYJ', city: 'New York',       name: 'Jets',        fullName: 'New York Jets',            espnId: '20', conference: 'AFC', division: 'East' },
  // AFC North
  { abbr: 'BAL', city: 'Baltimore',      name: 'Ravens',      fullName: 'Baltimore Ravens',         espnId: '33', conference: 'AFC', division: 'North' },
  { abbr: 'CIN', city: 'Cincinnati',     name: 'Bengals',     fullName: 'Cincinnati Bengals',       espnId: '4',  conference: 'AFC', division: 'North' },
  { abbr: 'CLE', city: 'Cleveland',      name: 'Browns',      fullName: 'Cleveland Browns',         espnId: '5',  conference: 'AFC', division: 'North' },
  { abbr: 'PIT', city: 'Pittsburgh',     name: 'Steelers',    fullName: 'Pittsburgh Steelers',      espnId: '23', conference: 'AFC', division: 'North' },
  // AFC South
  { abbr: 'HOU', city: 'Houston',        name: 'Texans',      fullName: 'Houston Texans',           espnId: '34', conference: 'AFC', division: 'South' },
  { abbr: 'IND', city: 'Indianapolis',   name: 'Colts',       fullName: 'Indianapolis Colts',       espnId: '11', conference: 'AFC', division: 'South' },
  { abbr: 'JAX', city: 'Jacksonville',   name: 'Jaguars',     fullName: 'Jacksonville Jaguars',     espnId: '30', conference: 'AFC', division: 'South' },
  { abbr: 'TEN', city: 'Tennessee',      name: 'Titans',      fullName: 'Tennessee Titans',         espnId: '10', conference: 'AFC', division: 'South' },
  // AFC West
  { abbr: 'DEN', city: 'Denver',         name: 'Broncos',     fullName: 'Denver Broncos',           espnId: '7',  conference: 'AFC', division: 'West' },
  { abbr: 'KC',  city: 'Kansas City',    name: 'Chiefs',      fullName: 'Kansas City Chiefs',       espnId: '12', conference: 'AFC', division: 'West' },
  { abbr: 'LV',  city: 'Las Vegas',      name: 'Raiders',     fullName: 'Las Vegas Raiders',        espnId: '13', conference: 'AFC', division: 'West' },
  { abbr: 'LAC', city: 'Los Angeles',    name: 'Chargers',    fullName: 'Los Angeles Chargers',     espnId: '24', conference: 'AFC', division: 'West' },
  // NFC East
  { abbr: 'DAL', city: 'Dallas',         name: 'Cowboys',     fullName: 'Dallas Cowboys',           espnId: '6',  conference: 'NFC', division: 'East' },
  { abbr: 'NYG', city: 'New York',       name: 'Giants',      fullName: 'New York Giants',          espnId: '19', conference: 'NFC', division: 'East' },
  { abbr: 'PHI', city: 'Philadelphia',   name: 'Eagles',      fullName: 'Philadelphia Eagles',      espnId: '21', conference: 'NFC', division: 'East' },
  { abbr: 'WSH', city: 'Washington',     name: 'Commanders',  fullName: 'Washington Commanders',    espnId: '28', conference: 'NFC', division: 'East' },
  // NFC North
  { abbr: 'CHI', city: 'Chicago',        name: 'Bears',       fullName: 'Chicago Bears',            espnId: '3',  conference: 'NFC', division: 'North' },
  { abbr: 'DET', city: 'Detroit',        name: 'Lions',       fullName: 'Detroit Lions',            espnId: '8',  conference: 'NFC', division: 'North' },
  { abbr: 'GB',  city: 'Green Bay',      name: 'Packers',     fullName: 'Green Bay Packers',        espnId: '9',  conference: 'NFC', division: 'North' },
  { abbr: 'MIN', city: 'Minnesota',      name: 'Vikings',     fullName: 'Minnesota Vikings',        espnId: '16', conference: 'NFC', division: 'North' },
  // NFC South
  { abbr: 'ATL', city: 'Atlanta',        name: 'Falcons',     fullName: 'Atlanta Falcons',          espnId: '1',  conference: 'NFC', division: 'South' },
  { abbr: 'CAR', city: 'Carolina',       name: 'Panthers',    fullName: 'Carolina Panthers',        espnId: '29', conference: 'NFC', division: 'South' },
  { abbr: 'NO',  city: 'New Orleans',    name: 'Saints',      fullName: 'New Orleans Saints',       espnId: '18', conference: 'NFC', division: 'South' },
  { abbr: 'TB',  city: 'Tampa Bay',      name: 'Buccaneers',  fullName: 'Tampa Bay Buccaneers',     espnId: '27', conference: 'NFC', division: 'South' },
  // NFC West
  { abbr: 'ARI', city: 'Arizona',        name: 'Cardinals',   fullName: 'Arizona Cardinals',        espnId: '22', conference: 'NFC', division: 'West' },
  { abbr: 'LAR', city: 'Los Angeles',    name: 'Rams',        fullName: 'Los Angeles Rams',         espnId: '14', conference: 'NFC', division: 'West' },
  { abbr: 'SF',  city: 'San Francisco',  name: 'San Francisco 49ers', fullName: 'San Francisco 49ers', espnId: '25', conference: 'NFC', division: 'West' },
  { abbr: 'SEA', city: 'Seattle',        name: 'Seahawks',    fullName: 'Seattle Seahawks',         espnId: '26', conference: 'NFC', division: 'West' },
];

export const TEAM_COUNT = NFL_TEAMS.length; // 32

/** Fast abbr → NFLTeam lookup */
export const TEAM_BY_ABBR: Record<string, NFLTeam> = Object.fromEntries(
  NFL_TEAMS.map((t) => [t.abbr, t])
);

/** ESPN abbreviation → full name, used for score matching in session B */
export const ESPN_TO_FULL: Record<string, string> = Object.fromEntries(
  NFL_TEAMS.map((t) => [t.abbr, t.fullName])
);

/** ESPN numeric team ID → our abbr, used as fallback in score normalization */
export const ESPN_ID_TO_ABBR: Record<string, string> = Object.fromEntries(
  NFL_TEAMS.map((t) => [t.espnId, t.abbr])
);
