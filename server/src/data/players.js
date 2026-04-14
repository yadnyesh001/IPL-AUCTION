// 110 IPL all-time players. Ratings roughly bell-curved around 8.
// Stored as a JS module (not JSON) so we can keep comments and regenerate easily.

const RAW = [
  ['MS Dhoni', 9.6], ['Virat Kohli', 9.8], ['Rohit Sharma', 9.6], ['AB de Villiers', 9.7],
  ['Chris Gayle', 9.5], ['Suresh Raina', 9.2], ['David Warner', 9.3], ['Shane Watson', 9.0],
  ['Lasith Malinga', 9.2], ['Dwayne Bravo', 9.0], ['Jasprit Bumrah', 9.5], ['Ravindra Jadeja', 9.3],
  ['Hardik Pandya', 9.1], ['KL Rahul', 9.0], ['Shikhar Dhawan', 8.9], ['Rishabh Pant', 9.0],
  ['Andre Russell', 9.2], ['Sunil Narine', 9.0], ['Kieron Pollard', 8.9], ['Yusuf Pathan', 8.4],
  ['Robin Uthappa', 8.3], ['Gautam Gambhir', 8.8], ['Virender Sehwag', 8.8], ['Yuvraj Singh', 8.7],
  ['Adam Gilchrist', 8.9], ['Matthew Hayden', 8.6], ['Shaun Marsh', 8.4], ['Michael Hussey', 8.7],
  ['Brendon McCullum', 8.5], ['Jacques Kallis', 8.6], ['Ricky Ponting', 8.3], ['Mahela Jayawardene', 8.2],
  ['Kumar Sangakkara', 8.4], ['Shane Warne', 8.7], ['Anil Kumble', 8.4], ['Harbhajan Singh', 8.5],
  ['Zaheer Khan', 8.4], ['Ashish Nehra', 8.2], ['Praveen Kumar', 8.0], ['Munaf Patel', 7.9],
  ['Amit Mishra', 8.2], ['Piyush Chawla', 8.0], ['R Ashwin', 8.7], ['Mohammed Shami', 8.6],
  ['Umesh Yadav', 8.2], ['Bhuvneshwar Kumar', 8.6], ['Deepak Chahar', 8.2], ['Mohammed Siraj', 8.5],
  ['Yuzvendra Chahal', 8.6], ['Kuldeep Yadav', 8.3], ['Rashid Khan', 9.1], ['Trent Boult', 8.7],
  ['Kagiso Rabada', 8.8], ['Pat Cummins', 8.7], ['Mitchell Starc', 8.6], ['Josh Hazlewood', 8.4],
  ['Nathan Coulter-Nile', 8.0], ['James Faulkner', 8.1], ['Glenn Maxwell', 8.7], ['Aaron Finch', 8.3],
  ['Steve Smith', 8.6], ['Faf du Plessis', 8.7], ['Quinton de Kock', 8.6], ['Jos Buttler', 9.0],
  ['Jonny Bairstow', 8.5], ['Ben Stokes', 8.5], ['Eoin Morgan', 8.3], ['Moeen Ali', 8.1],
  ['Sam Curran', 8.3], ['Tom Curran', 7.9], ['Chris Morris', 8.2], ['Dwayne Smith', 7.8],
  ['Marlon Samuels', 7.9], ['Darren Sammy', 7.7], ['Nicholas Pooran', 8.4], ['Evin Lewis', 8.0],
  ['Shimron Hetmyer', 8.1], ['Sanju Samson', 8.4], ['Shreyas Iyer', 8.5], ['Shubman Gill', 8.7],
  ['Ishan Kishan', 8.3], ['Prithvi Shaw', 8.0], ['Devdutt Padikkal', 7.9], ['Ruturaj Gaikwad', 8.4],
  ['Tilak Varma', 8.1], ['Yashasvi Jaiswal', 8.3], ['Venkatesh Iyer', 7.9], ['Dinesh Karthik', 8.2],
  ['Parthiv Patel', 7.7], ['Wriddhiman Saha', 7.8], ['Manish Pandey', 8.0], ['Ambati Rayudu', 8.1],
  ['Kedar Jadhav', 7.8], ['Axar Patel', 8.3], ['Washington Sundar', 7.9], ['Krunal Pandya', 7.9],
  ['Rahul Tewatia', 7.8], ['Ravi Bishnoi', 7.9], ['Varun Chakravarthy', 8.1], ['Khaleel Ahmed', 7.7],
  ['Arshdeep Singh', 8.2], ['Avesh Khan', 7.9], ['T Natarajan', 7.8], ['Prasidh Krishna', 7.7],
  ['Harshal Patel', 8.1], ['Shardul Thakur', 7.9], ['Marcus Stoinis', 8.1], ['Liam Livingstone', 8.2],
  ['Tim David', 8.0], ['Cameron Green', 8.2], ['Jason Holder', 8.0], ['Odean Smith', 7.6],
  ['Lockie Ferguson', 8.1], ['Adam Zampa', 7.9], ['Wanindu Hasaranga', 8.3]
].slice(0, 110);

if (RAW.length !== 110) {
  throw new Error(`players.js: expected 110, got ${RAW.length}`);
}

const PLAYERS = RAW.map(([name, rating], i) => ({
  id: `p${String(i + 1).padStart(3, '0')}`,
  name,
  rating,
  image: null,
}));

module.exports = PLAYERS;
