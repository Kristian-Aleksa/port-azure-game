// ---------------------------------------------------------------------------
// Port Azur — configuration and balance tables (v2)
// ---------------------------------------------------------------------------
const GAME_TITLE = 'Port Azur';
const SAVE_PREFIX = 'portazur.v2.';
const SAVE_VERSION = 2;
const MAP_V = 2; // map generation version: 2 = tunnels at random spots along the back wall
const SLOTS = ['auto', '1', '2', '3'];

// Isometric geometry: 2:1 pixel-art diamonds, 16 model units per tile edge.
const TW = 64, TH = 32, HTW = 32, HTH = 16;
const UNITS = 16;
const SEA_Z = -6;          // sea surface sits a few pixels under the land
const WALL_H = 12;         // stone retaining wall at the mountain's foot
const STEP = 8;            // pixels per terrain level
const LVL_MIN = -3, LVL_MAX = 4;

// Map: x runs along the coast (west -> east), y from the mountains (north) to the sea (south).
const MAP_W = 96, MAP_H = 46;
const PLAY_X0 = 12, PLAY_X1 = 83;
const EXT_PX = 48, EXT_PB = 40, EXT_PF = 40; // scenery beyond the map: sides, back, front

const T_SEA = 0, T_BEACH = 1, T_GRASS = 2, T_MOUNT = 3;
const N_ROAD = 1, N_RAIL = 2, N_PORTAL = 4, N_BUS = 8, N_CIRCUIT = 16;

const VIEWS = [0, 3];

const DAY_MIN = 1440;
const DAY_RATE = 13;       // game minutes per real second, 06:00-22:00 at 1x (~74 s)
const NIGHT_RATE = 60;     // at night (~8 s): a whole day is about 1.4 minutes at normal speed
const SPEEDS = [0, 1, 2, 4];

const LEVELS = [
  { name: 'Hamlet', pop: 0 },
  { name: 'Village', pop: 60 },
  { name: 'Town', pop: 180 },
  { name: 'Large Town', pop: 450 },
  { name: 'City', pop: 1100 },
  { name: 'Large City', pop: 2800 },
  { name: 'Metropolis', pop: 6500 },
  { name: 'Principality', pop: 13000 },
];

// ---- economy ------------------------------------------------------------------
const ECON = {
  start: 4000,
  portRate: 6.5,            // $ per served resident per ship
  services: 0.9,            // city services $ per resident per day
  roadUpkeep: 1.2, railUpkeep: 2, spanUpkeep: 20,
  loanRate: 0.004,          // daily interest on a loan carried over from an older save
  wholesale: 0.55,          // shops pay this share of the retail price for stock
  bankruptDays: 7,
  terraform: 150,           // per level per tile
};
// Bank loans: interest is charged every evening on what is still owed. One of each kind at a
// time, at most two at once. The two larger ones unlock as the city grows (LEVELS index).
const LOANS = [
  { id: 'small', name: 'Small loan', amount: 3000, rate: 0.03, lvl: 0, who: 'Quayside Savings Bank' },
  { id: 'business', name: 'Business loan', amount: 8000, rate: 0.025, lvl: 0, who: 'Quayside Savings Bank' },
  { id: 'development', name: 'Development loan', amount: 25000, rate: 0.018, lvl: 2, who: 'Banque de la Riviera' },
  { id: 'investment', name: 'Investment loan', amount: 75000, rate: 0.012, lvl: 4, who: 'Banque de la Riviera' },
];
const MAX_LOANS = 2;
const TAX = {
  low: { name: 'Low', mult: 0.85, joy: 4 },
  normal: { name: 'Normal', mult: 1, joy: 0 },
  high: { name: 'High', mult: 1.2, joy: -7 },
};

// Harbour levels: residents served, base income, delivery trucks per morning
const PORT_LV = [
  { name: 'Fishing Quay', cap: 800, base: 80, trucks: 6, ship: 0, cost: 0, lvl: 0 },
  { name: 'Cargo Harbour', cap: 2600, base: 450, trucks: 16, ship: 1, cost: 45000, lvl: 4 },
  { name: 'Container Port', cap: 7500, base: 1300, trucks: 40, ship: 2, cost: 140000, lvl: 6 },
];
const TUNNEL_TRUCKS = 8, FREIGHT_TRUCKS = 16;

// Shop goods: daily need per resident, and when residents start to care
const GOODS = {
  groceries: { name: 'Groceries', need: 1.0, minPop: 0, missing: -16, has: 4, short: 22 },
  clothes: { name: 'Clothes', need: 0.12, minPop: 60, missing: -5, has: 3, short: 8 },
  utilities: { name: 'Utilities', need: 0.07, minPop: 120, missing: -4, has: 2, short: 6 },
};

const CATS = [
  { id: 'housing', name: 'Homes', key: '1', icon: 'home', tip: 'Homes for residents. Each resident pays into the daily ship income.' },
  { id: 'shops', name: 'Shops', key: '2', icon: 'shop', tip: 'Groceries, clothes and utilities. Restocked by trucks every morning.' },
  { id: 'leisure', name: 'Leisure', key: '3', icon: 'leaf', tip: 'Parks, cafés and pools that lift happiness in a radius.' },
  { id: 'landmark', name: 'Landmarks', key: '4', icon: 'star', tip: 'Expensive specialty buildings with the biggest happiness boost, plus the Grand Prix.' },
  { id: 'tourism', name: 'Tourism', key: '5', icon: 'camera', tip: 'Tourist centres, hotels and intercity routes that bring visitors.' },
  { id: 'transport', name: 'Transport', key: '6', icon: 'bus', tip: 'Roads, rails, stops, lines, tunnels and bridges.' },
  { id: 'terrain', name: 'Terrain', key: '7', icon: 'terrain', tip: 'Raise or lower land to shape terraces, hills and valleys.' },
  { id: 'port', name: 'Harbour', key: '8', icon: 'anchor', tip: 'Your harbour earns most of the money. Upgrades are expensive.' },
];

// Building definitions. Arrays are per upgrade level (1..3). size = [w, h] in tiles.
const B = {
  // --- homes ---------------------------------------------------------------
  cottage: { cat: 'housing', name: 'Cottage', cost: 300, lvl: 0, cap: [4, 6, 8], place: 'grass', road: true, walk: 5,
    desc: 'A whitewashed family house with a terracotta roof and a lemon tree.' },
  apartment: { cat: 'housing', name: 'Apartment Block', cost: 1200, lvl: 0, cap: [16, 24, 32], place: 'grass', road: true, walk: 5,
    desc: 'Ochre balconies, laundry lines and a rooftop water tank.' },
  townhouse: { cat: 'housing', name: 'Old Town Houses', cost: 700, lvl: 1, cap: [9, 13, 18], place: 'grass', road: true, walk: 5,
    desc: 'Narrow pastel houses with green shutters, like the old Rock.' },
  belle: { cat: 'housing', name: 'Belle Époque Residence', cost: 3600, lvl: 2, cap: [36, 52, 70], place: 'grass', road: true, walk: 5,
    desc: 'Cream stone, wrought-iron balconies and a slate mansard roof.' },
  villa: { cat: 'housing', name: 'Seaside Villa', cost: 6500, lvl: 3, cap: [5, 7, 9], spend: 4, place: 'grass', road: true, walk: 6,
    desc: 'Wealthy residents spend four times more. Loves a sea view and raised ground.' },
  tower: { cat: 'housing', name: 'Riviera Tower', cost: 15000, lvl: 4, cap: [90, 130, 170], place: 'grass', road: true, walk: 5,
    desc: 'White wraparound balconies stacked above the bay.' },
  skyscraper: { cat: 'housing', name: 'Twin Odéon Tower', cost: 40000, lvl: 5, cap: [200, 280, 360], place: 'grass', road: true, walk: 5,
    desc: 'Glass twin towers with a crown that catches the evening sun.' },

  // --- shops ---------------------------------------------------------------
  grocer: { cat: 'shops', name: 'Corner Grocer', cost: 700, lvl: 0, goods: { groceries: [60, 90, 130] }, price: { groceries: 2 }, radius: [4, 5, 5], staff: 14, place: 'grass', road: true,
    desc: 'Bread, tomatoes and gossip. Groceries for the immediate neighbourhood.' },
  supermarket: { cat: 'shops', name: 'Supermarket', cost: 5000, lvl: 3, goods: { groceries: [300, 450, 650] }, price: { groceries: 1.8 }, radius: [6, 7, 7], staff: 60, place: 'grass', road: true,
    desc: 'Cheap groceries in bulk. Needs a lot of customers to stay open.' },
  markethall: { cat: 'shops', name: 'Market Hall', cost: 11000, lvl: 4, goods: { groceries: [700, 1000, 1400] }, price: { groceries: 2.2 }, radius: [8, 9, 9], staff: 120, joy: 1, place: 'grass', road: true,
    desc: 'A covered Riviera market. Huge stock and a little extra happiness nearby.' },
  boutique: { cat: 'shops', name: 'Boutique', cost: 2200, lvl: 1, goods: { clothes: [25, 38, 55] }, price: { clothes: 14 }, radius: [7, 8, 8], staff: 22, place: 'grass', road: true,
    desc: 'Linen shirts and sunglasses. Clothes for the neighbourhood.' },
  fashion: { cat: 'shops', name: 'Fashion House', cost: 9000, lvl: 3, goods: { clothes: [70, 105, 150] }, price: { clothes: 22 }, radius: [9, 10, 10], staff: 70, place: 'grass', road: true,
    desc: 'Designer labels at Monte Carlo prices.' },
  dept: { cat: 'shops', name: 'Department Store', cost: 20000, lvl: 5, goods: { clothes: [160, 240, 330], utilities: [80, 120, 170] }, price: { clothes: 16, utilities: 12 }, radius: [10, 11, 12], staff: 170, place: 'grass', road: true,
    desc: 'Clothes and household goods under a glass dome.' },
  hardware: { cat: 'shops', name: 'Hardware Store', cost: 1800, lvl: 1, goods: { utilities: [20, 30, 45] }, price: { utilities: 10 }, radius: [7, 8, 8], staff: 18, place: 'grass', road: true,
    desc: 'Light bulbs, paint and plumbing. Utilities for the neighbourhood.' },
  electronics: { cat: 'shops', name: 'Electronics Shop', cost: 7000, lvl: 3, goods: { utilities: [45, 70, 100] }, price: { utilities: 18 }, radius: [8, 9, 9], staff: 60, place: 'grass', road: true,
    desc: 'Phones, televisions and repairs.' },
  homecenter: { cat: 'shops', name: 'Home Center', cost: 13000, lvl: 4, goods: { utilities: [120, 180, 260] }, price: { utilities: 12 }, radius: [10, 11, 11], staff: 110, place: 'grass', road: true,
    desc: 'Everything for the house, for a whole district.' },

  // --- leisure ---------------------------------------------------------------
  park: { cat: 'leisure', name: 'Pocket Park', cost: 300, lvl: 0, radius: [3, 4, 4], joy: [1.0, 1.3, 1.6], upkeep: 4, calm: true, place: 'grass', road: false,
    desc: 'Lawn and shade trees. Small radius, cheap, eases crowding.' },
  cafe: { cat: 'leisure', name: 'Café Terrace', cost: 1200, lvl: 0, radius: [3, 4, 4], joy: [1.1, 1.4, 1.7], upkeep: 10, cafe: true, place: 'grass', road: true,
    desc: 'Earns a little from residents and tourists in its radius.' },
  plaza: { cat: 'leisure', name: 'Fountain Plaza', cost: 1400, lvl: 1, radius: [4, 5, 5], joy: [1.3, 1.6, 2.0], upkeep: 10, appeal: 1, place: 'grass', road: false,
    desc: 'Palms and a fountain. A meeting point that tourists like too.' },
  pool: { cat: 'leisure', name: 'Public Pool', cost: 3500, lvl: 2, radius: [5, 6, 6], joy: [1.0, 1.2, 1.5], heat: true, upkeep: 30, place: 'grass', road: true,
    desc: 'A big splash for the whole neighbourhood. Expensive to run.' },
  beachclub: { cat: 'leisure', name: 'Beach Club', cost: 5000, lvl: 3, radius: [5, 5, 6], joy: [1.2, 1.5, 1.8], heat: true, appeal: 2, noise: 2, upkeep: 20, place: 'beach', road: true,
    desc: 'Lifts the neighbourhood and draws tourists, but parties late on the sand.' },
  garden: { cat: 'leisure', name: 'Botanical Garden', cost: 9000, lvl: 4, radius: [7, 8, 8], joy: [2.0, 2.4, 2.8], appeal: 3, upkeep: 45, place: 'grass', road: true,
    desc: 'Cacti and terraces. A big happiness boost and a tourist draw.' },

  // --- landmarks ---------------------------------------------------------------
  gallery: { cat: 'landmark', name: 'Art Gallery', cost: 25000, lvl: 3, radius: [7], joy: [3.0], appeal: 4, ticket: 6, upkeep: 80, place: 'grass', road: true, maxLevel: 1,
    desc: 'White galleries and a sculpture garden.' },
  disco: { cat: 'landmark', name: 'Disco Club', cost: 30000, lvl: 3, radius: [6], joy: [3.0], appeal: 4, ticket: 8, noise: 2, night: true, upkeep: 90, place: 'grass', road: true, maxLevel: 1,
    desc: 'Neon and bass until dawn. Neighbours right next to it hate the noise.' },
  museum: { cat: 'landmark', name: 'Museum', cost: 45000, lvl: 4, size: [2, 1], radius: [8], joy: [3.5], appeal: 6, ticket: 10, upkeep: 120, place: 'grass', road: true, maxLevel: 1,
    desc: 'Columns, a dome and a hall of maritime history.' },
  obstower: { cat: 'landmark', name: 'Observation Tower', cost: 40000, lvl: 4, radius: [10], joy: [2.6], appeal: 6, ticket: 7, upkeep: 70, place: 'grass', road: true, maxLevel: 1,
    desc: 'A slender tower with a panoramic deck over the coast.' },
  aquarium: { cat: 'landmark', name: 'Oceanographic Aquarium', cost: 70000, lvl: 4, size: [2, 1], radius: [9], joy: [4.0], appeal: 9, ticket: 14, upkeep: 160, place: 'beach', road: true, maxLevel: 1,
    desc: 'A grand facade above the waves with sharks inside. Built on the beach.' },
  mall: { cat: 'landmark', name: 'Shopping Mall', cost: 90000, lvl: 5, size: [2, 2], radius: [10], joy: [2.5], appeal: 4, goods: { groceries: [900], clothes: [220], utilities: [150] }, price: { groceries: 1.9, clothes: 17, utilities: 13 }, staff: 260, place: 'grass', road: true, maxLevel: 1,
    desc: 'Groceries, clothes and utilities under one glass roof.' },
  zoo: { cat: 'landmark', name: 'Zoo', cost: 80000, lvl: 5, size: [2, 2], radius: [10], joy: [4.0], appeal: 8, ticket: 12, upkeep: 250, place: 'grass', road: true, maxLevel: 1,
    desc: 'Giraffes, flamingos and a children\'s farm.' },
  stadium: { cat: 'landmark', name: 'Football Stadium', cost: 100000, lvl: 5, size: [2, 2], radius: [12], joy: [3.5], appeal: 7, ticket: 9, noise: 3, upkeep: 220, place: 'grass', road: true, maxLevel: 1, unique: true,
    desc: 'Match day every week fills the stands and the cafés, and wakes the neighbours.' },
  casino: { cat: 'landmark', name: 'Grand Casino', cost: 60000, lvl: 5, radius: [6], joy: [1.8], appeal: 6, ticket: 25, crowd: 2, upkeep: 0, place: 'grass', road: true, maxLevel: 1, unique: true,
    desc: 'Belle-époque domes. Earns a fortune from visitors, but crowds clog nearby streets.' },
  castle: { cat: 'landmark', name: "Prince's Palace", cost: 120000, lvl: 6, size: [2, 2], radius: [12], joy: [4.5], appeal: 10, ticket: 11, upkeep: 300, place: 'grass', road: true, maxLevel: 1, unique: true,
    desc: 'Crenellated walls, towers and the changing of the guard.' },
  f1: { cat: 'landmark', name: 'Grand Prix Licence', cost: 180000, lvl: 5, place: 'none', special: 'f1',
    desc: 'Design a street circuit. Every 20 days the Grand Prix fills the streets with fans and money.' },

  // --- tourism -----------------------------------------------------------------
  tourist: { cat: 'tourism', name: 'Tourist Centre', cost: 8000, lvl: 2, radius: [8], upkeep: 40, place: 'grass', road: true, maxLevel: 1,
    desc: 'Needed before intercity routes. Day tourists explore within its radius.' },
  guesthouse: { cat: 'tourism', name: 'Guest House', cost: 6000, lvl: 2, beds: [20, 30, 40], rate: 16, radius: [5], upkeep: 25, place: 'grass', road: true,
    desc: 'Rooms for tourists who stay the night.' },
  hotel: { cat: 'tourism', name: 'Grand Hôtel', cost: 35000, lvl: 4, size: [2, 1], beds: [120, 160, 200], rate: 30, radius: [6], appeal: 2, upkeep: 120, place: 'grass', road: true,
    desc: 'Domes, a red carpet and very expensive rooms.' },
  coach: { cat: 'tourism', name: 'Intercity Coach Route', cost: 18000, lvl: 2, place: 'line', line: 'coach',
    desc: 'Coaches from the road tunnel to a bus stop near a Tourist Centre. Brings day tourists.' },
  irail: { cat: 'tourism', name: 'Intercity Rail Route', cost: 45000, lvl: 3, place: 'line', line: 'irail',
    desc: 'Trains from the rail tunnel to a station near a Tourist Centre. Brings many tourists.' },

  // --- transport -------------------------------------------------------------
  road: { cat: 'transport', name: 'Road', cost: 60, lvl: 0, place: 'drag', net: N_ROAD,
    desc: 'Asphalt with tree-lined sidewalks. Drag to build. Climbs one terrace level with a ramp.' },
  rail: { cat: 'transport', name: 'Rail Track', cost: 150, lvl: 2, place: 'drag', net: N_RAIL,
    desc: 'Drag to build. Trains only run on lines you set up.' },
  busstop: { cat: 'transport', name: 'Bus Stop', cost: 400, lvl: 1, upkeep: 5, radius: [4], place: 'road',
    desc: 'Place on a road, then add it to a bus line.' },
  station: { cat: 'transport', name: 'Rail Station', cost: 5000, lvl: 2, upkeep: 40, radius: [5], place: 'rail', road: true,
    desc: 'Place on a straight track next to a road, then add it to a train line.' },
  busline: { cat: 'transport', name: 'New Bus Line', cost: 1000, lvl: 1, place: 'line', line: 'bus',
    desc: 'Click bus stops in order. Each line needs buses, which cost money to run.' },
  trainline: { cat: 'transport', name: 'New Train Line', cost: 5000, lvl: 2, place: 'line', line: 'rail',
    desc: 'Click stations in order. Trains are fast but expensive to run.' },
  rtunnel: { cat: 'transport', name: 'Road Tunnel', cost: 500, lvl: 1, place: 'span', span: 'tunnel', net: N_ROAD,
    desc: 'Drag straight through higher ground or the mountain. Priced per tile.' },
  ttunnel: { cat: 'transport', name: 'Rail Tunnel', cost: 700, lvl: 2, place: 'span', span: 'tunnel', net: N_RAIL,
    desc: 'Drag straight through higher ground or the mountain. Priced per tile.' },
  rbridge: { cat: 'transport', name: 'Road Bridge', cost: 350, lvl: 1, place: 'span', span: 'bridge', net: N_ROAD,
    desc: 'Drag straight across lower ground or water between two tiles at the same height.' },
  tbridge: { cat: 'transport', name: 'Rail Bridge', cost: 500, lvl: 2, place: 'span', span: 'bridge', net: N_RAIL,
    desc: 'Drag straight across lower ground or water between two tiles at the same height.' },

  // --- terrain -------------------------------------------------------------------
  raise: { cat: 'terrain', name: 'Raise Land', cost: ECON.terraform, lvl: 0, place: 'terra', terra: 1,
    desc: 'Click or drag over empty plots to raise them one level. Raised homes get better sea views.' },
  lower: { cat: 'terrain', name: 'Lower Land', cost: ECON.terraform, lvl: 0, place: 'terra', terra: -1,
    desc: 'Click or drag over empty plots to lower them one level. Bridges can cross lower land.' },

  // --- harbour -------------------------------------------------------------------
  port: { cat: 'port', name: 'New Harbour', cost: 110000, lvl: 5, size: [5, 1], place: 'coast5', road: true,
    desc: 'A second quay on five straight beach tiles. Its own ship and trucks every morning.' },
};
const B_ORDER = Object.keys(B);
const HOUSING = new Set(B_ORDER.filter((k) => B[k].cap));
const SHOPS = new Set(B_ORDER.filter((k) => B[k].goods));
const LEISURE = new Set(B_ORDER.filter((k) => B[k].joy != null));
const LANDMARK = new Set(B_ORDER.filter((k) => B[k].cat === 'landmark' && k !== 'f1'));
const HOTELS = new Set(['guesthouse', 'hotel']);

const LINE_KIND = {
  bus: { name: 'Bus line', stop: 'busstop', vehicle: 'Bus', setup: 1000, perStop: 150, buy: 2500, run: 110, fare: 1.5, seats: 40, trips: 6, net: N_ROAD, colors: ['#e2533d', '#2d6fb8', '#f2b233', '#3fa66a', '#8a56c2', '#e07ab0'] },
  rail: { name: 'Train line', stop: 'station', vehicle: 'Train', setup: 5000, perStop: 600, buy: 15000, run: 450, fare: 3, seats: 180, trips: 6, net: N_RAIL, colors: ['#c2412f', '#1f5f9e', '#d9a21a', '#2f8a57'] },
  coach: { name: 'Intercity coach', stop: 'busstop', vehicle: 'Coach', setup: 18000, perStop: 0, buy: 6000, run: 300, fare: 0, seats: 50, trips: 3, net: N_ROAD, colors: ['#7a3b6b'], outside: true },
  irail: { name: 'Intercity rail', stop: 'station', vehicle: 'Intercity train', setup: 45000, perStop: 0, buy: 25000, run: 900, fare: 0, seats: 200, trips: 2, net: N_RAIL, colors: ['#5b2a86'], outside: true },
};

const UPGRADE_LVL = [0, 2, 3];
const UPGRADE_COST = [0, 0.6, 1.2];
const MOVE_FEE = 0.25, DEMOLISH_FEE = 0.1, PAINT_FEE = 0.05;

const WEATHER = {
  // weather sways the ship and the tourists, but not the residents' happiness
  sunny: { name: 'Sunny', p: 0.6 },
  cloudy: { name: 'Cloudy', p: 0.27 },
  heat: { name: 'Heatwave', p: 0.08 },
  rain: { name: 'Rain', p: 0.035 },
  storm: { name: 'Storm', p: 0.015 },
};

const TRANSIT_WALK = 4;
const ABANDON_HOME = 0.40, UNREST = 0.45, STRIKE = 0.40;
const HAPPY_GAIN = 1.4; // every happiness effect is this much stronger now that weather plays no part
const F1 = { every: 20, raceStart: 14 * 60, laps: 5, cars: 10, tileFee: 400, raceCost: 60000, minTiles: 24 };
