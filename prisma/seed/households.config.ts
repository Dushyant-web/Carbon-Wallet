export interface ApplianceProfile {
  name: string;
  type: string;
  rating: string;
  powerKw: number;
  avgHoursPerDay: number;
}

export interface VehicleProfile {
  name: string;
  type: string;
  fuel: string;
  kmPerUnit: number;
  monthlyKm: number;
}

export interface MemberProfile {
  name: string;
  email: string;
  role: string;
}

export interface RecommendationProfile {
  action: string;
  description: string;
  category: string;
  kgSaved: number;
  inrSaved: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  status: "PENDING" | "ACCEPTED" | "COMPLETED";
}

export interface HouseholdProfile {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  size: number;
  homeType: string;
  floorAreaM2: number;
  monthlyBudgetInr: number;
  joinCode: string;
  targetMonthlyKg: number; // Target for current month (2026-03)
  intendedTrendPct: number; // vs prior month (2026-02) e.g. -8.4%
  solarKwh: number;
  primaryCategory: "Electricity" | "Transport" | "Travel" | "Food";
  primarySharePct: number;
  members: MemberProfile[];
  appliances: ApplianceProfile[];
  vehicles: VehicleProfile[];
  recommendations: RecommendationProfile[];
}

export const HOUSEHOLD_PROFILES: HouseholdProfile[] = [
  // 1. Sharma Residence (286 kg, -8.4% trend, Electricity heavy)
  {
    id: "hh_01_sharma",
    name: "Sharma Residence",
    city: "Greater Noida", // Knowledge Park II, the demo mohalla (knowledgePark.ts)
    state: "UP",
    country: "IN",
    size: 4,
    homeType: "Apartment",
    floorAreaM2: 180,
    monthlyBudgetInr: 25000,
    joinCode: "SHARMA01",
    targetMonthlyKg: 286.0,
    intendedTrendPct: -8.4,
    solarKwh: 0,
    primaryCategory: "Electricity",
    primarySharePct: 51.7, // ~148 kg
    members: [
      { name: "Arjun Sharma", email: "arjun.sharma@example.com", role: "OWNER" },
      { name: "Pooja Sharma", email: "pooja.sharma@example.com", role: "MEMBER" },
      { name: "Rohan Sharma", email: "rohan.sharma@example.com", role: "MEMBER" },
      { name: "Meera Sharma", email: "meera.sharma@example.com", role: "VIEWER" },
    ],
    appliances: [
      { name: "Living Room Split AC", type: "AC", rating: "3_STAR", powerKw: 1.5, avgHoursPerDay: 5.5 },
      { name: "Master Bedroom Dual Inverter AC", type: "AC", rating: "5_STAR_INVERTER", powerKw: 1.2, avgHoursPerDay: 7.0 },
      { name: "Frost-Free Refrigerator", type: "Refrigerator", rating: "4_STAR", powerKw: 0.25, avgHoursPerDay: 24.0 },
      { name: "Front-Load Washing Machine", type: "WashingMachine", rating: "5_STAR", powerKw: 0.9, avgHoursPerDay: 1.0 },
    ],
    vehicles: [
      { name: "Honda City", type: "Car", fuel: "Petrol", kmPerUnit: 14.0, monthlyKm: 380 },
    ],
    recommendations: [
      {
        action: "Optimize AC Setpoint: Shift from 20°C to 24°C",
        description: "Air conditioning is driving 51% of your emissions this cycle. Modulating daytime setpoints cuts cooling draw by 24% without sacrificing comfort.",
        category: "Electricity",
        kgSaved: 34.2,
        inrSaved: 950,
        difficulty: "EASY",
        status: "PENDING",
      },
      {
        action: "Install Smart Power Strips for AV and Work Desks",
        description: "Eliminates phantom vampire draw on home entertainment and monitors.",
        category: "Electricity",
        kgSaved: 8.5,
        inrSaved: 280,
        difficulty: "EASY",
        status: "PENDING",
      },
    ],
  },

  // 2. Mehta Family (342 kg, Transport heavy)
  {
    id: "hh_02_mehta",
    name: "Mehta Family",
    city: "Delhi",
    state: "DL",
    country: "IN",
    size: 5,
    homeType: "Independent House",
    floorAreaM2: 210,
    monthlyBudgetInr: 32000,
    joinCode: "MEHTA02",
    targetMonthlyKg: 342.0,
    intendedTrendPct: -0.9,
    solarKwh: 0,
    primaryCategory: "Transport",
    primarySharePct: 46.2, // ~158 kg
    members: [
      { name: "Virendra Mehta", email: "virendra.mehta@example.com", role: "OWNER" },
      { name: "Sunita Mehta", email: "sunita.mehta@example.com", role: "MEMBER" },
      { name: "Aarav Mehta", email: "aarav.mehta@example.com", role: "MEMBER" },
      { name: "Diya Mehta", email: "diya.mehta@example.com", role: "MEMBER" },
      { name: "Kavita Mehta", email: "kavita.mehta@example.com", role: "VIEWER" },
    ],
    appliances: [
      { name: "Drawing Room AC", type: "AC", rating: "3_STAR", powerKw: 1.6, avgHoursPerDay: 4.0 },
      { name: "Side-by-Side Refrigerator", type: "Refrigerator", rating: "3_STAR", powerKw: 0.35, avgHoursPerDay: 24.0 },
    ],
    vehicles: [
      { name: "Hyundai Creta Diesel", type: "SUV", fuel: "Diesel", kmPerUnit: 13.0, monthlyKm: 550 },
      { name: "Maruti Swift Petrol", type: "Car", fuel: "Petrol", kmPerUnit: 14.5, monthlyKm: 280 },
    ],
    recommendations: [
      {
        action: "Carpooling / Metro Shift for Gurugram Commute",
        description: "High fuel consumption on Delhi-Gurugram highway drives 46% of emissions. Shift 2 days to Yellow Line metro.",
        category: "Transport",
        kgSaved: 48.0,
        inrSaved: 2100,
        difficulty: "MEDIUM",
        status: "PENDING",
      },
    ],
  },

  // 3. Verma Household (214 kg)
  {
    id: "hh_03_verma",
    name: "Verma Household",
    city: "Greater Noida",
    state: "UP",
    country: "IN",
    size: 3,
    homeType: "Apartment",
    floorAreaM2: 150,
    monthlyBudgetInr: 20000,
    joinCode: "VERMA03",
    targetMonthlyKg: 214.0,
    intendedTrendPct: -1.8,
    solarKwh: 0,
    primaryCategory: "Electricity",
    primarySharePct: 54.2, // ~116 kg
    members: [
      { name: "Sameer Verma", email: "sameer.verma@example.com", role: "OWNER" },
      { name: "Anita Verma", email: "anita.verma@example.com", role: "MEMBER" },
      { name: "Kabir Verma", email: "kabir.verma@example.com", role: "MEMBER" },
    ],
    appliances: [
      { name: "Split AC 1.5T", type: "AC", rating: "NON_INVERTER", powerKw: 1.6, avgHoursPerDay: 5.0 },
      { name: "Double Door Refrigerator", type: "Refrigerator", rating: "4_STAR", powerKw: 0.22, avgHoursPerDay: 24.0 },
    ],
    vehicles: [
      { name: "Maruti WagonR", type: "Car", fuel: "Petrol", kmPerUnit: 16.0, monthlyKm: 300 },
    ],
    recommendations: [
      {
        action: "Upgrade Master Bedroom AC to 5-Star Dual Inverter",
        description: "10-year old non-inverter unit operates at low COP. Upgrading cuts 26 kg CO₂e/mo with state energy rebate.",
        category: "Electricity",
        kgSaved: 26.5,
        inrSaved: 820,
        difficulty: "HARD",
        status: "PENDING",
      },
    ],
  },

  // 4. Kapoor Residence (398 kg, luxury SUV, transport heavy)
  {
    id: "hh_04_kapoor",
    name: "Kapoor Residence",
    city: "Gurugram",
    state: "HR",
    country: "IN",
    size: 4,
    homeType: "Villa",
    floorAreaM2: 260,
    monthlyBudgetInr: 45000,
    joinCode: "KAPOOR04",
    targetMonthlyKg: 398.0,
    intendedTrendPct: -0.5,
    solarKwh: 0,
    primaryCategory: "Transport",
    primarySharePct: 52.0, // ~207 kg
    members: [
      { name: "Rajesh Kapoor", email: "rajesh.kapoor@example.com", role: "OWNER" },
      { name: "Nalini Kapoor", email: "nalini.kapoor@example.com", role: "MEMBER" },
      { name: "Tara Kapoor", email: "tara.kapoor@example.com", role: "MEMBER" },
      { name: "Dev Kapoor", email: "dev.kapoor@example.com", role: "VIEWER" },
    ],
    appliances: [
      { name: "VRF Central Cooling Unit", type: "AC", rating: "4_STAR", powerKw: 3.5, avgHoursPerDay: 6.0 },
      { name: "Smart French-Door Refrigerator", type: "Refrigerator", rating: "3_STAR", powerKw: 0.4, avgHoursPerDay: 24.0 },
    ],
    vehicles: [
      { name: "Toyota Fortuner Diesel", type: "SUV", fuel: "Diesel", kmPerUnit: 10.5, monthlyKm: 980 },
    ],
    recommendations: [
      {
        action: "Fleet Electrification: Swap Primary SUV for EV",
        description: "Diesel SUV commute contributes over 200 kg CO₂e. Transitioning to EV cuts household footprint by 40%.",
        category: "Transport",
        kgSaved: 92.0,
        inrSaved: 6400,
        difficulty: "HARD",
        status: "PENDING",
      },
    ],
  },

  // 5. Singh Family (271 kg, 6 members)
  {
    id: "hh_05_singh",
    name: "Singh Family",
    city: "Lucknow",
    state: "UP",
    country: "IN",
    size: 6,
    homeType: "Independent House",
    floorAreaM2: 240,
    monthlyBudgetInr: 28000,
    joinCode: "SINGH05",
    targetMonthlyKg: 271.0,
    intendedTrendPct: -1.1,
    solarKwh: 0,
    primaryCategory: "Electricity",
    primarySharePct: 47.9, // ~130 kg
    members: [
      { name: "Harpreet Singh", email: "harpreet.singh@example.com", role: "OWNER" },
      { name: "Gurpreet Singh", email: "gurpreet.singh@example.com", role: "MEMBER" },
      { name: "Simran Singh", email: "simran.singh@example.com", role: "MEMBER" },
      { name: "Jasleen Singh", email: "jasleen.singh@example.com", role: "MEMBER" },
      { name: "Balwant Singh", email: "balwant.singh@example.com", role: "VIEWER" },
      { name: "Surjit Singh", email: "surjit.singh@example.com", role: "VIEWER" },
    ],
    appliances: [
      { name: "Split AC", type: "AC", rating: "3_STAR", powerKw: 1.5, avgHoursPerDay: 4.0 },
      { name: "Electric Water Heaters (x2)", type: "WaterHeater", rating: "3_STAR", powerKw: 2.0, avgHoursPerDay: 2.5 },
    ],
    vehicles: [
      { name: "Public Transit Commuter", type: "PublicTransit", fuel: "Electric", kmPerUnit: 1.0, monthlyKm: 600 },
    ],
    recommendations: [
      {
        action: "Solar Water Heating System Installation",
        description: "Multiple geysers in 6-member home generate 35 kg CO₂e. Solar thermal collector pays off in 14 months.",
        category: "Electricity",
        kgSaved: 31.0,
        inrSaved: 1250,
        difficulty: "MEDIUM",
        status: "PENDING",
      },
    ],
  },

  // 6. Gupta Residence (176 kg, Rooftop Solar 5kW!)
  {
    id: "hh_06_gupta",
    name: "Gupta Residence",
    city: "Jaipur",
    state: "RJ",
    country: "IN",
    size: 4,
    homeType: "Independent House",
    floorAreaM2: 200,
    monthlyBudgetInr: 22000,
    joinCode: "GUPTA06",
    targetMonthlyKg: 176.0,
    intendedTrendPct: -1.7,
    solarKwh: 380, // Solar offset!
    primaryCategory: "Electricity",
    primarySharePct: 39.8, // ~70 kg net
    members: [
      { name: "Manish Gupta", email: "manish.gupta@example.com", role: "OWNER" },
      { name: "Ritu Gupta", email: "ritu.gupta@example.com", role: "MEMBER" },
      { name: "Varun Gupta", email: "varun.gupta@example.com", role: "MEMBER" },
      { name: "Shanti Gupta", email: "shanti.gupta@example.com", role: "VIEWER" },
    ],
    appliances: [
      { name: "5kW On-Grid Rooftop Solar PV", type: "SolarPV", rating: "5_STAR", powerKw: 5.0, avgHoursPerDay: 6.0 },
      { name: "5-Star Inverter AC", type: "AC", rating: "5_STAR_INVERTER", powerKw: 1.1, avgHoursPerDay: 5.0 },
      { name: "BLDC High-Efficiency Fans (x6)", type: "Fan", rating: "5_STAR", powerKw: 0.18, avgHoursPerDay: 12.0 },
    ],
    vehicles: [
      { name: "Maruti Celerio CNG", type: "Car", fuel: "CNG", kmPerUnit: 25.0, monthlyKm: 320 },
    ],
    recommendations: [
      {
        action: "Optimize Solar Self-Consumption Time-of-Use",
        description: "Schedule washing machine and heavy loads between 11 AM - 3 PM to maximize 100% clean solar generation.",
        category: "Electricity",
        kgSaved: 14.5,
        inrSaved: 480,
        difficulty: "EASY",
        status: "ACCEPTED",
      },
    ],
  },

  // 7. Khan Household (148 kg, EV, High score 91)
  {
    id: "hh_07_khan",
    name: "Khan Household",
    city: "Bengaluru",
    state: "KA",
    country: "IN",
    size: 3,
    homeType: "Apartment",
    floorAreaM2: 140,
    monthlyBudgetInr: 24000,
    joinCode: "KHAN07",
    targetMonthlyKg: 148.0,
    intendedTrendPct: -1.3,
    solarKwh: 120,
    primaryCategory: "Electricity",
    primarySharePct: 43.2, // ~64 kg
    members: [
      { name: "Tariq Khan", email: "tariq.khan@example.com", role: "OWNER" },
      { name: "Ayesha Khan", email: "ayesha.khan@example.com", role: "MEMBER" },
      { name: "Zayan Khan", email: "zayan.khan@example.com", role: "MEMBER" },
    ],
    appliances: [
      { name: "Inverter Heat Pump AC", type: "AC", rating: "5_STAR_INVERTER", powerKw: 0.9, avgHoursPerDay: 4.0 },
      { name: "BLDC Smart Fans", type: "Fan", rating: "5_STAR", powerKw: 0.12, avgHoursPerDay: 10.0 },
      { name: "Induction Range", type: "Cooktop", rating: "5_STAR", powerKw: 1.4, avgHoursPerDay: 1.2 },
    ],
    vehicles: [
      { name: "Tata Nexon EV", type: "Car", fuel: "Electric", kmPerUnit: 7.0, monthlyKm: 220 },
    ],
    recommendations: [
      {
        action: "Automate EV Charging with Low-Carbon Grid Windows",
        description: "Charge EVs exclusively between 1:00 AM - 5:00 AM when regional Karnataka grid wind energy peaks.",
        category: "Electricity",
        kgSaved: 12.8,
        inrSaved: 390,
        difficulty: "EASY",
        status: "ACCEPTED",
      },
    ],
  },

  // 8. Patel Residence (132 kg, Top Leader, Score 94)
  {
    id: "hh_08_patel",
    name: "Patel Residence",
    city: "Mumbai",
    state: "MH",
    country: "IN",
    size: 4,
    homeType: "Apartment",
    floorAreaM2: 110,
    monthlyBudgetInr: 22000,
    joinCode: "PATEL08",
    targetMonthlyKg: 132.0,
    intendedTrendPct: -0.8,
    solarKwh: 0,
    primaryCategory: "Food",
    primarySharePct: 40.9, // ~54 kg
    members: [
      { name: "Hitesh Patel", email: "hitesh.patel@example.com", role: "OWNER" },
      { name: "Geeta Patel", email: "geeta.patel@example.com", role: "MEMBER" },
      { name: "Devanshi Patel", email: "devanshi.patel@example.com", role: "MEMBER" },
      { name: "Rushil Patel", email: "rushil.patel@example.com", role: "MEMBER" },
    ],
    appliances: [
      { name: "Inverter Refrigerator", type: "Refrigerator", rating: "5_STAR", powerKw: 0.18, avgHoursPerDay: 24.0 },
      { name: "BLDC Ceiling Fans", type: "Fan", rating: "5_STAR", powerKw: 0.14, avgHoursPerDay: 8.0 },
    ],
    vehicles: [
      { name: "Mumbai Metro & Local Train", type: "PublicTransit", fuel: "Electric", kmPerUnit: 1.0, monthlyKm: 550 },
    ],
    recommendations: [
      {
        action: "Community Compost & Food Waste Diverter",
        description: "Food basket comprises largest portion. Zero-waste composter reduces methane decomposition footprint.",
        category: "Food",
        kgSaved: 9.6,
        inrSaved: 0,
        difficulty: "EASY",
        status: "COMPLETED",
      },
    ],
  },

  // 9. Iyer Family (238 kg, Chennai)
  {
    id: "hh_09_iyer",
    name: "Iyer Family",
    city: "Chennai",
    state: "TN",
    country: "IN",
    size: 5,
    homeType: "Apartment",
    floorAreaM2: 175,
    monthlyBudgetInr: 26000,
    joinCode: "IYER09",
    targetMonthlyKg: 238.0,
    intendedTrendPct: -1.2,
    solarKwh: 0,
    primaryCategory: "Electricity",
    primarySharePct: 58.8, // ~140 kg
    members: [
      { name: "Venkat Iyer", email: "venkat.iyer@example.com", role: "OWNER" },
      { name: "Lakshmi Iyer", email: "lakshmi.iyer@example.com", role: "MEMBER" },
      { name: "Karthik Iyer", email: "karthik.iyer@example.com", role: "MEMBER" },
      { name: "Subramanian Iyer", email: "subramanian.iyer@example.com", role: "VIEWER" },
      { name: "Janaki Iyer", email: "janaki.iyer@example.com", role: "VIEWER" },
    ],
    appliances: [
      { name: "5-Star Inverter AC (x2)", type: "AC", rating: "5_STAR_INVERTER", powerKw: 1.1, avgHoursPerDay: 7.0 },
      { name: "Copper Coil Refrigerator", type: "Refrigerator", rating: "4_STAR", powerKw: 0.22, avgHoursPerDay: 24.0 },
    ],
    vehicles: [
      { name: "Toyota Urban Cruiser Hyryder", type: "Car", fuel: "Hybrid", kmPerUnit: 22.0, monthlyKm: 280 },
    ],
    recommendations: [
      {
        action: "Roof Cool-Coat High-Albedo Reflective Coating",
        description: "Reflective paint on rooftop reduces Chennai summer heat ingress by 4.5°C, reducing cooling load 18%.",
        category: "Electricity",
        kgSaved: 25.0,
        inrSaved: 840,
        difficulty: "MEDIUM",
        status: "PENDING",
      },
    ],
  },

  // 10. Roy Household (229 kg, Aviation/Travel heavy)
  {
    id: "hh_10_roy",
    name: "Roy Household",
    city: "Kolkata",
    state: "WB",
    country: "IN",
    size: 3,
    homeType: "Apartment",
    floorAreaM2: 160,
    monthlyBudgetInr: 30000,
    joinCode: "ROY10",
    targetMonthlyKg: 229.0,
    intendedTrendPct: -1.3,
    solarKwh: 0,
    primaryCategory: "Travel",
    primarySharePct: 43.6, // ~100 kg
    members: [
      { name: "Anirban Roy", email: "anirban.roy@example.com", role: "OWNER" },
      { name: "Debashree Roy", email: "debashree.roy@example.com", role: "MEMBER" },
      { name: "Sourav Roy", email: "sourav.roy@example.com", role: "MEMBER" },
    ],
    appliances: [
      { name: "5-Star Split AC", type: "AC", rating: "5_STAR", powerKw: 1.2, avgHoursPerDay: 4.5 },
      { name: "Inverter Refrigerator", type: "Refrigerator", rating: "4_STAR", powerKw: 0.2, avgHoursPerDay: 24.0 },
    ],
    vehicles: [
      { name: "Ride-share & Metro", type: "PublicTransit", fuel: "Electric", kmPerUnit: 1.0, monthlyKm: 240 },
    ],
    recommendations: [
      {
        action: "High-Speed Rail Alternative for Regional Business Trips",
        description: "Frequent short-haul flights to Delhi/Mumbai make up 44% of footprint. Shift 1 roundtrip to Vande Bharat.",
        category: "Travel",
        kgSaved: 38.0,
        inrSaved: 3200,
        difficulty: "EASY",
        status: "PENDING",
      },
    ],
  },
];
