// 200 IPL players. Ratings uniformly distributed from 6.0 to 10.0
// (linear interpolation: best player = 10.0, weakest = 6.0).
// Names are ordered roughly best-to-worst so the mapping is sensible.

const NAMES = [
  // Tier 1: mega stars (1-20) → ratings ~10.0–9.6
  'Virat Kohli', 'AB de Villiers', 'MS Dhoni', 'Rohit Sharma', 'Chris Gayle',
  'Jasprit Bumrah', 'Ravindra Jadeja', 'David Warner', 'Andre Russell', 'Rashid Khan',
  'Jos Buttler', 'Lasith Malinga', 'KL Rahul', 'Suresh Raina', 'Hardik Pandya',
  'Dwayne Bravo', 'Sunil Narine', 'Rishabh Pant', 'Shane Watson', 'Glenn Maxwell',

  // Tier 2: stars (21-40) → ratings ~9.6–9.2
  'Shubman Gill', 'Kagiso Rabada', 'Shane Warne', 'Pat Cummins', 'Faf du Plessis',
  'Adam Gilchrist', 'R Ashwin', 'Gautam Gambhir', 'Virender Sehwag', 'Trent Boult',
  'Yuvraj Singh', 'Michael Hussey', 'Mohammed Shami', 'Kieron Pollard', 'Bhuvneshwar Kumar',
  'Shikhar Dhawan', 'Jacques Kallis', 'Matthew Hayden', 'Mitchell Starc', 'Quinton de Kock',

  // Tier 3 (41-60) → ~9.2–8.8
  'Yuzvendra Chahal', 'Brendon McCullum', 'Steve Smith', 'Kane Williamson', 'Kumar Sangakkara',
  'Mohammed Siraj', 'Harbhajan Singh', 'Ben Stokes', 'Jonny Bairstow', 'Sanju Samson',
  'Anil Kumble', 'Shreyas Iyer', 'Ruturaj Gaikwad', 'Nicholas Pooran', 'Josh Hazlewood',
  'Yusuf Pathan', 'Dinesh Karthik', 'Wanindu Hasaranga', 'Liam Livingstone', 'Zaheer Khan',

  // Tier 4 (61-80) → ~8.8–8.4
  'Axar Patel', 'Ravi Bishnoi', 'Robin Uthappa', 'Dale Steyn', 'Ricky Ponting',
  'Mahela Jayawardene', 'Eoin Morgan', 'Sam Curran', 'Chris Morris', 'Ambati Rayudu',
  'Arshdeep Singh', 'Marcus Stoinis', 'Cameron Green', 'Varun Chakravarthy', 'Harshal Patel',
  'Aaron Finch', 'Deepak Chahar', 'Kuldeep Yadav', 'Ishan Kishan', 'Yashasvi Jaiswal',

  // Tier 5 (81-100) → ~8.4–8.0
  'Tilak Varma', 'Umesh Yadav', 'Amit Mishra', 'Moeen Ali', 'Tim David',
  'Jason Holder', 'Lockie Ferguson', 'Jofra Archer', 'Adam Zampa', 'Piyush Chawla',
  'Washington Sundar', 'Rahul Tewatia', 'Shardul Thakur', 'James Faulkner', 'Devon Conway',
  'Rahmanullah Gurbaz', 'Heinrich Klaasen', 'Anrich Nortje', 'Mujeeb ur Rahman', 'Mohammad Nabi',

  // Tier 6 (101-120) → ~8.0–7.6
  'Mohit Sharma', 'Shaun Marsh', 'Prithvi Shaw', 'Tom Curran', 'Sandeep Sharma',
  'Hashim Amla', 'David Miller', 'Krunal Pandya', 'Manish Pandey', 'Ashish Nehra',
  'Evin Lewis', 'Khaleel Ahmed', 'Shimron Hetmyer', 'Mark Wood', 'Pravin Tambe',
  'Devdutt Padikkal', 'Ashok Dinda', 'Marlon Samuels', 'Chris Lynn', 'Daniel Sams',

  // Tier 7 (121-140) → ~7.6–7.2
  'Phil Salt', 'Harry Brook', 'Irfan Pathan', 'Praveen Kumar', 'Munaf Patel',
  'Ishant Sharma', 'RP Singh', 'Dirk Nannes', 'Nathan Coulter-Nile', 'Wriddhiman Saha',
  'Parthiv Patel', 'Kedar Jadhav', 'Dasun Shanaka', 'Dushmantha Chameera', 'Darren Sammy',
  'Imran Tahir', 'Mayank Agarwal', 'Jean-Paul Duminy', 'Morne Morkel', 'Basil Thampi',

  // Tier 8 (141-160) → ~7.2–6.8
  'Siddarth Kaul', 'Jaydev Unadkat', 'T Natarajan', 'Prasidh Krishna', 'Avesh Khan',
  'Noor Ahmad', 'Lungi Ngidi', 'Venkatesh Iyer', 'Shahbaz Ahmed', 'Mustafizur Rahman',
  'Chetan Sakariya', 'Dwayne Smith', 'Owais Shah', 'Paul Collingwood', 'Herschelle Gibbs',
  'Andrew Symonds', 'Jason Gillespie', 'Doug Bollinger', 'Mitchell Johnson', 'Wayne Parnell',

  // Tier 9 (161-180) → ~6.8–6.4
  'Karanveer Singh', 'Rajat Bhatia', 'Naman Ojha', 'Iqbal Abdulla', 'Mandeep Singh',
  'Karun Nair', 'Sarfaraz Khan', 'Murali Vijay', 'Cheteshwar Pujara', 'Dhawal Kulkarni',
  'Ravi Rampaul', 'Shaun Tait', 'Kane Richardson', 'Abhimanyu Mithun', 'VRV Singh',
  'Laxmipathy Balaji', 'Vinay Kumar', 'Pragyan Ojha', 'Pankaj Singh', 'Joginder Sharma',

  // Tier 10 (181-200) → ~6.4–6.0
  'Sreenath Aravind', 'Sachin Baby', 'Rohan Raje', 'Ashton Turner', 'Josh Philippe',
  'Colin Munro', 'Colin de Grandhomme', 'Martin Guptill', 'Jimmy Neesham', 'Mitchell Santner',
  'Tim Seifert', 'Reece Topley', 'Joe Root', 'Chris Jordan', 'Dawid Malan',
  'Will Jacks', 'Alex Hales', 'Jason Roy', 'Ravi Bopara', 'Tymal Mills',
];

// Sanity checks — catch typos/dupes at boot.
if (NAMES.length !== 200) {
  throw new Error(`players.js: expected 200 names, got ${NAMES.length}`);
}
const dupes = NAMES.filter((n, i) => NAMES.indexOf(n) !== i);
if (dupes.length) {
  throw new Error(`players.js: duplicate names: ${[...new Set(dupes)].join(', ')}`);
}

// Uniform linear ratings: index 0 → 10.0, index 199 → 6.0.
// Math: rating = 10 - 4 * (i / (n - 1)), rounded to 1 decimal.
const PLAYERS = NAMES.map((name, i) => {
  const rating = Math.round((10 - (4 * i) / (NAMES.length - 1)) * 10) / 10;
  return {
    id: `p${String(i + 1).padStart(3, '0')}`,
    name,
    rating,
    image: null,
  };
});

module.exports = PLAYERS;
