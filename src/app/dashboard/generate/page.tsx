"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Loader2,
  MapPin,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { searchLocations, type SearchResult } from "@/lib/api/mapbox";
import { toast } from "@/lib/toast";

type Pace = "relaxed" | "moderate" | "packed";
type RankingStyle = "most_popular" | "best_spread" | "hidden_gems";

type Destination = {
  mapboxId?: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  suggestedDays?: number;
};
type CandidateStop = {
  name: string;
  lat: number;
  lng: number;
  popularityScore?: number;
  category?: string;
};
type PresetDay = {
  title: string;
  summary: string;
  stops: CandidateStop[];
};
type PopularDestination = Destination & {
  suggestedDays: number;
  planDays: PresetDay[];
};

const POPULAR_DESTINATIONS: PopularDestination[] = [
  {
    name: "Paris",
    country: "France",
    lat: 48.8566,
    lng: 2.3522,
    suggestedDays: 3,
    planDays: [
      {
        title: "Classic Paris icons",
        summary: "Start with the Eiffel Tower, the Seine, and the grand museum quarter.",
        stops: [
          { name: "Eiffel Tower", lat: 48.8584, lng: 2.2945, category: "landmark" },
          { name: "Trocadero Gardens", lat: 48.8628, lng: 2.2876, category: "viewpoint" },
          { name: "Louvre Museum", lat: 48.8606, lng: 2.3376, category: "museum" },
        ],
      },
      {
        title: "Historic heart and islands",
        summary: "Follow the old city from Notre-Dame to the Latin Quarter.",
        stops: [
          { name: "Notre-Dame Cathedral", lat: 48.853, lng: 2.3499, category: "historic" },
          { name: "Sainte-Chapelle", lat: 48.8554, lng: 2.345, category: "historic" },
          { name: "Luxembourg Gardens", lat: 48.8462, lng: 2.3372, category: "park" },
        ],
      },
      {
        title: "Montmartre and grand boulevards",
        summary: "End with hilltop views, cafe streets, and the Arc de Triomphe.",
        stops: [
          { name: "Sacré-Cœur Basilica", lat: 48.8867, lng: 2.3431, category: "landmark" },
          { name: "Montmartre", lat: 48.8867, lng: 2.3409, category: "neighborhood" },
          { name: "Arc de Triomphe", lat: 48.8738, lng: 2.295, category: "landmark" },
        ],
      },
    ],
  },
  {
    name: "Rome",
    country: "Italy",
    lat: 41.9028,
    lng: 12.4964,
    suggestedDays: 3,
    planDays: [
      {
        title: "Ancient Rome",
        summary: "Walk through the Colosseum, Forum, and imperial core.",
        stops: [
          { name: "Colosseum", lat: 41.8902, lng: 12.4922, category: "historic" },
          { name: "Roman Forum", lat: 41.8925, lng: 12.4853, category: "historic" },
          { name: "Piazza Venezia", lat: 41.8958, lng: 12.4823, category: "square" },
        ],
      },
      {
        title: "Baroque Rome",
        summary: "Spend the day around fountains, piazzas, and atmospheric lanes.",
        stops: [
          { name: "Trevi Fountain", lat: 41.9009, lng: 12.4833, category: "landmark" },
          { name: "Pantheon", lat: 41.8986, lng: 12.4769, category: "historic" },
          { name: "Piazza Navona", lat: 41.8992, lng: 12.4731, category: "square" },
        ],
      },
      {
        title: "Vatican and Trastevere",
        summary: "Pair Vatican masterpieces with an evening across the river.",
        stops: [
          { name: "St. Peter's Basilica", lat: 41.9022, lng: 12.4539, category: "landmark" },
          { name: "Vatican Museums", lat: 41.9065, lng: 12.4536, category: "museum" },
          { name: "Trastevere", lat: 41.8896, lng: 12.4707, category: "neighborhood" },
        ],
      },
    ],
  },
  {
    name: "Barcelona",
    country: "Spain",
    lat: 41.3874,
    lng: 2.1686,
    suggestedDays: 3,
    planDays: [
      {
        title: "Gaudi essentials",
        summary: "Explore Barcelona's signature modernist landmarks.",
        stops: [
          { name: "Sagrada Familia", lat: 41.4036, lng: 2.1744, category: "landmark" },
          { name: "Casa Batlló", lat: 41.3917, lng: 2.1649, category: "architecture" },
          { name: "La Pedrera-Casa Milà", lat: 41.3954, lng: 2.1619, category: "architecture" },
        ],
      },
      {
        title: "Old city and waterfront",
        summary: "Move through Gothic lanes before ending by the sea.",
        stops: [
          { name: "Gothic Quarter", lat: 41.3839, lng: 2.1764, category: "historic" },
          { name: "La Boqueria Market", lat: 41.3817, lng: 2.1716, category: "food" },
          { name: "Barceloneta Beach", lat: 41.3784, lng: 2.1925, category: "beach" },
        ],
      },
      {
        title: "Parks and city views",
        summary: "Take in colorful park design and a broad city panorama.",
        stops: [
          { name: "Park Güell", lat: 41.4145, lng: 2.1527, category: "park" },
          { name: "Montjuïc Castle", lat: 41.3635, lng: 2.166, category: "viewpoint" },
          { name: "Magic Fountain of Montjuïc", lat: 41.3712, lng: 2.1517, category: "landmark" },
        ],
      },
    ],
  },
  {
    name: "Amsterdam",
    country: "Netherlands",
    lat: 52.3676,
    lng: 4.9041,
    suggestedDays: 3,
    planDays: [
      {
        title: "Canals and museums",
        summary: "Start with the canal belt and the city's major art museums.",
        stops: [
          { name: "Rijksmuseum", lat: 52.36, lng: 4.8852, category: "museum" },
          { name: "Van Gogh Museum", lat: 52.3584, lng: 4.8811, category: "museum" },
          { name: "Vondelpark", lat: 52.358, lng: 4.8686, category: "park" },
        ],
      },
      {
        title: "Historic Amsterdam",
        summary: "Follow the story of the old center and western canals.",
        stops: [
          { name: "Anne Frank House", lat: 52.3752, lng: 4.884, category: "historic" },
          { name: "Jordaan", lat: 52.3738, lng: 4.8806, category: "neighborhood" },
          { name: "Dam Square", lat: 52.3731, lng: 4.8922, category: "square" },
        ],
      },
      {
        title: "Markets and waterside",
        summary: "Mix neighborhood markets, canals, and contemporary waterfront views.",
        stops: [
          { name: "Albert Cuyp Market", lat: 52.3559, lng: 4.8953, category: "market" },
          { name: "De Pijp", lat: 52.3547, lng: 4.8945, category: "neighborhood" },
          { name: "A'DAM Lookout", lat: 52.384, lng: 4.9026, category: "viewpoint" },
        ],
      },
    ],
  },
  {
    name: "Istanbul",
    country: "Turkey",
    lat: 41.0082,
    lng: 28.9784,
    suggestedDays: 5,
    planDays: [
      {
        title: "Sultanahmet icons",
        summary: "Begin with Istanbul's imperial core.",
        stops: [
          { name: "Hagia Sophia", lat: 41.0086, lng: 28.98, category: "historic" },
          { name: "Blue Mosque", lat: 41.0054, lng: 28.9768, category: "historic" },
          { name: "Basilica Cistern", lat: 41.0084, lng: 28.9779, category: "historic" },
        ],
      },
      {
        title: "Ottoman palaces",
        summary: "Trace palace life from Topkapi to the Bosphorus edge.",
        stops: [
          { name: "Topkapi Palace", lat: 41.0115, lng: 28.9834, category: "palace" },
          { name: "Gülhane Park", lat: 41.0138, lng: 28.9813, category: "park" },
          { name: "Galata Bridge", lat: 41.0199, lng: 28.9737, category: "landmark" },
        ],
      },
      {
        title: "Bazaars and old streets",
        summary: "Spend the day among markets, mosques, and tea stops.",
        stops: [
          { name: "Grand Bazaar", lat: 41.0107, lng: 28.9681, category: "market" },
          { name: "Spice Bazaar", lat: 41.0165, lng: 28.9706, category: "market" },
          { name: "Süleymaniye Mosque", lat: 41.0162, lng: 28.9638, category: "historic" },
        ],
      },
      {
        title: "Beyoğlu and Galata",
        summary: "Cross to the modern side for towers, avenues, and nightlife.",
        stops: [
          { name: "Galata Tower", lat: 41.0256, lng: 28.9742, category: "viewpoint" },
          { name: "İstiklal Avenue", lat: 41.0337, lng: 28.9774, category: "street" },
          { name: "Taksim Square", lat: 41.037, lng: 28.985, category: "square" },
        ],
      },
      {
        title: "Bosphorus day",
        summary: "Finish with waterfront palaces and neighborhoods.",
        stops: [
          { name: "Dolmabahçe Palace", lat: 41.0392, lng: 29.0005, category: "palace" },
          { name: "Ortaköy Mosque", lat: 41.0472, lng: 29.0275, category: "landmark" },
          { name: "Bebek Waterfront", lat: 41.0776, lng: 29.0436, category: "waterfront" },
        ],
      },
    ],
  },
  {
    name: "Dubai",
    country: "UAE",
    lat: 25.2048,
    lng: 55.2708,
    suggestedDays: 5,
    planDays: [
      { title: "Downtown Dubai", summary: "See the skyline icons and fountains.", stops: [
        { name: "Burj Khalifa", lat: 25.1972, lng: 55.2744, category: "landmark" },
        { name: "Dubai Mall", lat: 25.1988, lng: 55.2796, category: "shopping" },
        { name: "Dubai Fountain", lat: 25.1952, lng: 55.2755, category: "landmark" },
      ] },
      { title: "Old Dubai", summary: "Explore creek crossings, souks, and heritage lanes.", stops: [
        { name: "Al Fahidi Historical District", lat: 25.2635, lng: 55.3003, category: "historic" },
        { name: "Dubai Creek", lat: 25.2644, lng: 55.3123, category: "waterfront" },
        { name: "Gold Souk", lat: 25.2711, lng: 55.2973, category: "market" },
      ] },
      { title: "Palm and marina", summary: "Spend the day around the coast and marina.", stops: [
        { name: "Palm Jumeirah", lat: 25.1124, lng: 55.139, category: "landmark" },
        { name: "Atlantis The Palm", lat: 25.1304, lng: 55.1171, category: "resort" },
        { name: "Dubai Marina Walk", lat: 25.0772, lng: 55.1358, category: "waterfront" },
      ] },
      { title: "Beach and culture", summary: "Mix sea views with modern cultural stops.", stops: [
        { name: "Jumeirah Beach", lat: 25.2049, lng: 55.2343, category: "beach" },
        { name: "Jumeirah Mosque", lat: 25.2339, lng: 55.2652, category: "landmark" },
        { name: "Museum of the Future", lat: 25.2191, lng: 55.2819, category: "museum" },
      ] },
      { title: "Desert edge", summary: "Close with gardens and desert-style experiences.", stops: [
        { name: "Dubai Miracle Garden", lat: 25.0602, lng: 55.2442, category: "garden" },
        { name: "Global Village", lat: 25.0672, lng: 55.3095, category: "entertainment" },
        { name: "Al Marmoom Desert Conservation Reserve", lat: 24.8328, lng: 55.3431, category: "nature" },
      ] },
    ],
  },
  {
    name: "Singapore",
    country: "Singapore",
    lat: 1.3521,
    lng: 103.8198,
    suggestedDays: 5,
    planDays: [
      { title: "Marina Bay arrival", summary: "Start with Singapore's futuristic waterfront.", stops: [
        { name: "Gardens by the Bay", lat: 1.2816, lng: 103.8636, category: "garden" },
        { name: "Marina Bay Sands", lat: 1.2834, lng: 103.8607, category: "landmark" },
        { name: "Merlion Park", lat: 1.2868, lng: 103.8545, category: "landmark" },
      ] },
      { title: "Civic district and river", summary: "Walk heritage buildings and riverside quays.", stops: [
        { name: "National Gallery Singapore", lat: 1.2904, lng: 103.8519, category: "museum" },
        { name: "Clarke Quay", lat: 1.2906, lng: 103.8465, category: "waterfront" },
        { name: "Fort Canning Park", lat: 1.2944, lng: 103.8466, category: "park" },
      ] },
      { title: "Culture districts", summary: "Explore temples, food streets, and colorful shophouses.", stops: [
        { name: "Chinatown Singapore", lat: 1.2836, lng: 103.8443, category: "neighborhood" },
        { name: "Little India", lat: 1.3067, lng: 103.8492, category: "neighborhood" },
        { name: "Kampong Glam", lat: 1.3029, lng: 103.8597, category: "neighborhood" },
      ] },
      { title: "Sentosa day", summary: "Make time for beaches, views, and island attractions.", stops: [
        { name: "Sentosa Island", lat: 1.2494, lng: 103.8303, category: "island" },
        { name: "Universal Studios Singapore", lat: 1.254, lng: 103.8238, category: "theme_park" },
        { name: "Siloso Beach", lat: 1.2546, lng: 103.8125, category: "beach" },
      ] },
      { title: "Nature and shopping", summary: "Finish with gardens, wildlife, and Orchard Road.", stops: [
        { name: "Singapore Botanic Gardens", lat: 1.3138, lng: 103.8159, category: "garden" },
        { name: "Orchard Road", lat: 1.3048, lng: 103.8318, category: "shopping" },
        { name: "Singapore Zoo", lat: 1.4043, lng: 103.793, category: "zoo" },
      ] },
    ],
  },
  {
    name: "Tokyo",
    country: "Japan",
    lat: 35.6762,
    lng: 139.6503,
    suggestedDays: 7,
    planDays: [
      { title: "Shinjuku and city views", summary: "Ease in with towers, gardens, and neon streets.", stops: [
        { name: "Tokyo Metropolitan Government Building", lat: 35.6896, lng: 139.6922, category: "viewpoint" },
        { name: "Shinjuku Gyoen", lat: 35.6852, lng: 139.7101, category: "park" },
        { name: "Omoide Yokocho", lat: 35.6938, lng: 139.7006, category: "food" },
      ] },
      { title: "Asakusa and Ueno", summary: "See old Tokyo temples, markets, and museums.", stops: [
        { name: "Sensō-ji", lat: 35.7148, lng: 139.7967, category: "temple" },
        { name: "Nakamise-dori Street", lat: 35.7118, lng: 139.7964, category: "market" },
        { name: "Ueno Park", lat: 35.7156, lng: 139.7745, category: "park" },
      ] },
      { title: "Shibuya and Harajuku", summary: "Spend a day on youth culture, shrines, and crossings.", stops: [
        { name: "Shibuya Crossing", lat: 35.6595, lng: 139.7005, category: "landmark" },
        { name: "Meiji Shrine", lat: 35.6764, lng: 139.6993, category: "shrine" },
        { name: "Takeshita Street", lat: 35.6716, lng: 139.7051, category: "shopping" },
      ] },
      { title: "Ginza and Imperial Tokyo", summary: "Pair polished avenues with palace gardens.", stops: [
        { name: "Imperial Palace East Gardens", lat: 35.6852, lng: 139.7568, category: "garden" },
        { name: "Ginza", lat: 35.6717, lng: 139.765, category: "shopping" },
        { name: "Tokyo Station", lat: 35.6812, lng: 139.7671, category: "landmark" },
      ] },
      { title: "Akihabara and Ryogoku", summary: "Explore electronics culture and sumo history.", stops: [
        { name: "Akihabara", lat: 35.6984, lng: 139.773, category: "neighborhood" },
        { name: "Kanda Myojin Shrine", lat: 35.7018, lng: 139.7674, category: "shrine" },
        { name: "Ryogoku Kokugikan", lat: 35.6969, lng: 139.7933, category: "culture" },
      ] },
      { title: "Odaiba waterfront", summary: "Take a relaxed futuristic bay day.", stops: [
        { name: "teamLab Planets TOKYO", lat: 35.6491, lng: 139.7898, category: "museum" },
        { name: "Odaiba Seaside Park", lat: 35.6297, lng: 139.7756, category: "waterfront" },
        { name: "Rainbow Bridge", lat: 35.6366, lng: 139.7631, category: "landmark" },
      ] },
      { title: "Tsukiji and Roppongi", summary: "Finish with food, art, and evening views.", stops: [
        { name: "Tsukiji Outer Market", lat: 35.6655, lng: 139.7707, category: "food" },
        { name: "Roppongi Hills", lat: 35.6605, lng: 139.7292, category: "viewpoint" },
        { name: "Tokyo Tower", lat: 35.6586, lng: 139.7454, category: "landmark" },
      ] },
    ],
  },
  {
    name: "New York",
    country: "USA",
    lat: 40.7128,
    lng: -74.006,
    suggestedDays: 5,
    planDays: [
      { title: "Midtown icons", summary: "Start with Manhattan's classic skyline stops.", stops: [
        { name: "Times Square", lat: 40.758, lng: -73.9855, category: "landmark" },
        { name: "Bryant Park", lat: 40.7536, lng: -73.9832, category: "park" },
        { name: "Empire State Building", lat: 40.7484, lng: -73.9857, category: "viewpoint" },
      ] },
      { title: "Central Park and museums", summary: "Spend the day uptown with green space and collections.", stops: [
        { name: "Central Park", lat: 40.7829, lng: -73.9654, category: "park" },
        { name: "The Metropolitan Museum of Art", lat: 40.7794, lng: -73.9632, category: "museum" },
        { name: "American Museum of Natural History", lat: 40.7813, lng: -73.9739, category: "museum" },
      ] },
      { title: "Downtown and harbor", summary: "Trace lower Manhattan history and the harborfront.", stops: [
        { name: "One World Observatory", lat: 40.713, lng: -74.0132, category: "viewpoint" },
        { name: "9/11 Memorial", lat: 40.7115, lng: -74.0134, category: "memorial" },
        { name: "Battery Park", lat: 40.7033, lng: -74.017, category: "park" },
      ] },
      { title: "Brooklyn day", summary: "Cross the river for bridges, parks, and brownstone streets.", stops: [
        { name: "Brooklyn Bridge", lat: 40.7061, lng: -73.9969, category: "landmark" },
        { name: "DUMBO", lat: 40.7033, lng: -73.9881, category: "neighborhood" },
        { name: "Brooklyn Bridge Park", lat: 40.7003, lng: -73.9967, category: "park" },
      ] },
      { title: "Village and Chelsea", summary: "End with food, art, and the High Line.", stops: [
        { name: "Washington Square Park", lat: 40.7308, lng: -73.9973, category: "park" },
        { name: "Chelsea Market", lat: 40.7423, lng: -74.006, category: "food" },
        { name: "The High Line", lat: 40.748, lng: -74.0048, category: "park" },
      ] },
    ],
  },
  {
    name: "Bangkok",
    country: "Thailand",
    lat: 13.7563,
    lng: 100.5018,
    suggestedDays: 5,
    planDays: [
      { title: "Royal Bangkok", summary: "Begin with temples and palace landmarks.", stops: [
        { name: "Grand Palace", lat: 13.7500, lng: 100.4913, category: "palace" },
        { name: "Wat Phra Kaew", lat: 13.7517, lng: 100.4926, category: "temple" },
        { name: "Wat Pho", lat: 13.7465, lng: 100.493, category: "temple" },
      ] },
      { title: "River and old town", summary: "Explore the Chao Phraya and riverside icons.", stops: [
        { name: "Wat Arun", lat: 13.7437, lng: 100.4889, category: "temple" },
        { name: "Pak Khlong Talat Flower Market", lat: 13.7414, lng: 100.4962, category: "market" },
        { name: "Chinatown Bangkok", lat: 13.7405, lng: 100.5107, category: "food" },
      ] },
      { title: "Markets and parks", summary: "Mix local shopping with a slower green-space afternoon.", stops: [
        { name: "Chatuchak Weekend Market", lat: 13.7999, lng: 100.5502, category: "market" },
        { name: "Lumphini Park", lat: 13.7307, lng: 100.5418, category: "park" },
        { name: "Jim Thompson House", lat: 13.7495, lng: 100.5283, category: "museum" },
      ] },
      { title: "Modern Bangkok", summary: "See malls, art, and skyline energy.", stops: [
        { name: "MBK Center", lat: 13.7445, lng: 100.5297, category: "shopping" },
        { name: "Bangkok Art and Culture Centre", lat: 13.7466, lng: 100.5300, category: "museum" },
        { name: "King Power Mahanakhon", lat: 13.7236, lng: 100.5293, category: "viewpoint" },
      ] },
      { title: "Floating market escape", summary: "Finish with a classic market excursion outside the core.", stops: [
        { name: "Taling Chan Floating Market", lat: 13.7765, lng: 100.4569, category: "market" },
        { name: "Wat Saket", lat: 13.7538, lng: 100.5066, category: "temple" },
        { name: "Khao San Road", lat: 13.7589, lng: 100.497, category: "street" },
      ] },
    ],
  },
  {
    name: "Bali",
    country: "Indonesia",
    lat: -8.4095,
    lng: 115.1889,
    suggestedDays: 7,
    planDays: [
      { title: "Ubud arrival", summary: "Start inland with temples, rice terraces, and craft streets.", stops: [
        { name: "Ubud Palace", lat: -8.5069, lng: 115.2625, category: "palace" },
        { name: "Ubud Monkey Forest", lat: -8.5193, lng: 115.2606, category: "nature" },
        { name: "Campuhan Ridge Walk", lat: -8.5035, lng: 115.2532, category: "walk" },
      ] },
      { title: "Rice terraces and water temple", summary: "Spend a scenic day north of Ubud.", stops: [
        { name: "Tegallalang Rice Terrace", lat: -8.4319, lng: 115.2793, category: "viewpoint" },
        { name: "Tirta Empul Temple", lat: -8.4159, lng: 115.3152, category: "temple" },
        { name: "Gunung Kawi", lat: -8.4227, lng: 115.3139, category: "historic" },
      ] },
      { title: "Waterfalls and villages", summary: "Explore Bali's lush interior.", stops: [
        { name: "Tegenungan Waterfall", lat: -8.5755, lng: 115.2896, category: "waterfall" },
        { name: "Goa Gajah", lat: -8.5239, lng: 115.2867, category: "historic" },
        { name: "Mas Village", lat: -8.5436, lng: 115.2797, category: "village" },
      ] },
      { title: "East Bali temples", summary: "Visit sacred water gardens and mountain views.", stops: [
        { name: "Pura Besakih", lat: -8.3739, lng: 115.4505, category: "temple" },
        { name: "Tirta Gangga", lat: -8.412, lng: 115.5871, category: "garden" },
        { name: "Lempuyang Temple", lat: -8.3917, lng: 115.6312, category: "temple" },
      ] },
      { title: "Seminyak and Canggu", summary: "Move to the coast for cafes, shops, and sunset beaches.", stops: [
        { name: "Seminyak Beach", lat: -8.6913, lng: 115.1571, category: "beach" },
        { name: "Canggu", lat: -8.6478, lng: 115.1385, category: "neighborhood" },
        { name: "Tanah Lot", lat: -8.6212, lng: 115.0868, category: "temple" },
      ] },
      { title: "Uluwatu cliffs", summary: "Spend a dramatic cliff-and-beach day in the south.", stops: [
        { name: "Uluwatu Temple", lat: -8.8291, lng: 115.0849, category: "temple" },
        { name: "Padang Padang Beach", lat: -8.8107, lng: 115.1023, category: "beach" },
        { name: "Garuda Wisnu Kencana Cultural Park", lat: -8.8104, lng: 115.1676, category: "culture" },
      ] },
      { title: "Nusa Dua wind-down", summary: "Close with calm beaches and a gentler final day.", stops: [
        { name: "Nusa Dua Beach", lat: -8.7982, lng: 115.2297, category: "beach" },
        { name: "Water Blow", lat: -8.8069, lng: 115.2368, category: "viewpoint" },
        { name: "Jimbaran Bay", lat: -8.7907, lng: 115.1601, category: "food" },
      ] },
    ],
  },
  {
    name: "Cape Town",
    country: "South Africa",
    lat: -33.9249,
    lng: 18.4241,
    suggestedDays: 7,
    planDays: [
      { title: "City bowl and waterfront", summary: "Start with the harbor and city landmarks.", stops: [
        { name: "V&A Waterfront", lat: -33.9068, lng: 18.4217, category: "waterfront" },
        { name: "Bo-Kaap", lat: -33.9216, lng: 18.4154, category: "neighborhood" },
        { name: "Company's Garden", lat: -33.9289, lng: 18.4173, category: "park" },
      ] },
      { title: "Table Mountain day", summary: "Center the day around Cape Town's defining mountain.", stops: [
        { name: "Table Mountain Aerial Cableway", lat: -33.9486, lng: 18.4021, category: "viewpoint" },
        { name: "Signal Hill", lat: -33.9176, lng: 18.4039, category: "viewpoint" },
        { name: "Kloof Street", lat: -33.9297, lng: 18.4104, category: "food" },
      ] },
      { title: "Atlantic beaches", summary: "Follow the coast through Clifton, Camps Bay, and Hout Bay.", stops: [
        { name: "Clifton Beach", lat: -33.9396, lng: 18.3771, category: "beach" },
        { name: "Camps Bay Beach", lat: -33.9513, lng: 18.3789, category: "beach" },
        { name: "Hout Bay Harbour", lat: -34.049, lng: 18.3489, category: "waterfront" },
      ] },
      { title: "Cape Peninsula", summary: "Make a full-day drive to the Cape's wild edge.", stops: [
        { name: "Chapman's Peak Drive", lat: -34.0875, lng: 18.357, category: "scenic_drive" },
        { name: "Cape Point", lat: -34.3568, lng: 18.4973, category: "nature" },
        { name: "Boulders Beach", lat: -34.1979, lng: 18.4517, category: "beach" },
      ] },
      { title: "Kirstenbosch and Constantia", summary: "Slow down with gardens and wine country close to town.", stops: [
        { name: "Kirstenbosch National Botanical Garden", lat: -33.9884, lng: 18.4329, category: "garden" },
        { name: "Constantia", lat: -34.0314, lng: 18.418, category: "wine" },
        { name: "Groot Constantia", lat: -34.0311, lng: 18.4186, category: "wine" },
      ] },
      { title: "Robben Island and Sea Point", summary: "Pair history with a relaxed promenade evening.", stops: [
        { name: "Robben Island Museum", lat: -33.8067, lng: 18.3662, category: "historic" },
        { name: "Sea Point Promenade", lat: -33.9166, lng: 18.3893, category: "walk" },
        { name: "Green Point Urban Park", lat: -33.9047, lng: 18.4081, category: "park" },
      ] },
      { title: "Winelands finale", summary: "Finish with a scenic day in the nearby winelands.", stops: [
        { name: "Stellenbosch", lat: -33.9321, lng: 18.8602, category: "town" },
        { name: "Franschhoek", lat: -33.9108, lng: 19.1196, category: "town" },
        { name: "Babylonstoren", lat: -33.8236, lng: 18.9254, category: "garden" },
      ] },
    ],
  },
];

const STREET_WORDS = [
  "street",
  "road",
  "rd",
  "st",
  "ave",
  "avenue",
  "highway",
  "blvd",
  "lane",
  "drive",
  "boulevard",
];

function looksLikeRoadName(v: string): boolean {
  const lower = v.toLowerCase();
  if (/\d/.test(lower) && STREET_WORDS.some((w) => lower.includes(` ${w}`))) return true;
  return STREET_WORDS.some((w) => lower === w || lower.endsWith(` ${w}`));
}

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function destinationPreviewImage(name: string) {
  return `https://picsum.photos/seed/${encodeURIComponent(name)}/800/500`;
}

export default function GenerateTripPage() {
  const router = useRouter();
  const [days, setDays] = useState("3");
  const [pace, setPace] = useState<Pace>("moderate");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [rankingStyle, setRankingStyle] = useState<RankingStyle>("most_popular");
  const [selectedStops, setSelectedStops] = useState<CandidateStop[]>([]);
  const [alternativeStops, setAlternativeStops] = useState<CandidateStop[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hasManualSwaps, setHasManualSwaps] = useState(false);
  const [loadingPopularKey, setLoadingPopularKey] = useState<string | null>(null);

  async function createPopularTrip(d: PopularDestination) {
    const key = `${d.name}-${d.country}`;
    setLoadingPopularKey(key);
    setDestination(d);
    setQuery(d.name);
    setDays(String(d.suggestedDays));
    setResults([]);
    setSelectedStops([]);
    setAlternativeStops([]);
    setHasManualSwaps(false);
    try {
      const res = await fetch("/api/trips/generate-from-destination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: `${d.name}, ${d.country}`,
          days: d.suggestedDays,
          pace: "moderate",
          rankingStyle: "most_popular",
          presetPlan: {
            name: `${d.name} · ${d.suggestedDays} day${d.suggestedDays === 1 ? "" : "s"}`,
            description: `A curated ${d.suggestedDays}-day itinerary for ${d.name}.`,
            days: d.planDays,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Could not create this preset trip.");
        return;
      }
      const tripId = data?.trip?.id as string | undefined;
      if (!tripId) {
        toast.error("Unexpected response from server.");
        return;
      }
      toast.success(`${d.name} itinerary created.`);
      router.push(`/planner/${tripId}`);
      router.refresh();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setLoadingPopularKey(null);
    }
  }

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // ignore geolocation errors; we still show default popular list
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSuggesting(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSuggesting(true);
      try {
        const rows = await searchLocations(q, userLocation ? { lng: userLocation.lng, lat: userLocation.lat } : undefined);
        const filtered = rows.filter((r) => !looksLikeRoadName(r.name)).slice(0, 8);
        setResults(filtered);
      } catch {
        setResults([]);
      } finally {
        setSuggesting(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, userLocation]);

  const popularByLocation = useMemo(() => {
    if (!userLocation) return POPULAR_DESTINATIONS.slice(0, 8);
    return [...POPULAR_DESTINATIONS]
      .sort(
        (a, b) =>
          haversineKm(userLocation, a) - haversineKm(userLocation, b)
      )
      .slice(0, 8);
  }, [userLocation]);

  const selectedLabel = destination?.name || query.trim();
  const selectedMapboxId = destination?.mapboxId;

  async function loadAreaSuggestions() {
    const n = Number.parseInt(days, 10);
    if (!selectedLabel || selectedLabel.length < 2 || !Number.isFinite(n) || n < 1 || n > 14) return;
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/trips/generate-from-destination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: true,
          ...(selectedMapboxId ? { mapboxId: selectedMapboxId } : { destination: selectedLabel }),
          days: n,
          pace,
          rankingStyle,
          ...(hasManualSwaps && selectedStops.length > 0 ? { selectedStops } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setSelectedStops(Array.isArray(data?.selectedStops) ? data.selectedStops : []);
      setAlternativeStops(Array.isArray(data?.alternativeStops) ? data.alternativeStops : []);
      setSelectedIndex(0);
    } finally {
      setLoadingPreview(false);
    }
  }

  function swapWithAlternative(altIdx: number) {
    if (selectedStops.length === 0 || altIdx < 0 || altIdx >= alternativeStops.length) return;
    const nextSelected = [...selectedStops];
    const nextAlternative = [...alternativeStops];
    const temp = nextSelected[selectedIndex] ?? nextSelected[0];
    nextSelected[selectedIndex] = nextAlternative[altIdx];
    nextAlternative[altIdx] = temp;
    setSelectedStops(nextSelected);
    setAlternativeStops(nextAlternative);
    setHasManualSwaps(true);
  }

  useEffect(() => {
    if (!selectedLabel) return;
    const timer = setTimeout(() => {
      void loadAreaSuggestions();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMapboxId, selectedLabel, days, pace, rankingStyle]);

  async function handleGenerate() {
    const n = Number.parseInt(days, 10);
    if (!selectedLabel || selectedLabel.length < 2) {
      toast.error("Choose a destination first.");
      return;
    }
    if (!Number.isFinite(n) || n < 1 || n > 14) {
      toast.error("Days must be between 1 and 14.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/trips/generate-from-destination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(selectedMapboxId ? { mapboxId: selectedMapboxId } : { destination: selectedLabel }),
          days: n,
          pace,
          rankingStyle,
          ...(selectedStops.length > 0 ? { selectedStops } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : "Could not generate itinerary.");
        return;
      }
      const tripId = data?.trip?.id as string | undefined;
      if (!tripId) {
        toast.error("Unexpected response from server.");
        return;
      }
      toast.success("Itinerary generated.");
      router.push(`/planner/${tripId}`);
      router.refresh();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
      <div className="mx-auto max-w-6xl">
        <section>
          <h1 className="flex items-center gap-2 text-5xl font-bold tracking-tight text-slate-900">
            <Sparkles className="h-8 w-8 text-amber-500" />
            Generate itinerary
          </h1>
          <p className="mt-3 max-w-3xl text-2xl leading-relaxed text-slate-700">
            Let our digital concierge curate an effortless travel experience. Define your preferences
            and watch your luxury itinerary unfold.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <Label
                  htmlFor="destination-search"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Destination
                </Label>
                <Input
                  id="destination-search"
                  placeholder="Where do you want to go?"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setDestination(null);
                    setHasManualSwaps(false);
                  }}
                  className="mt-2 min-h-14 rounded-xl border-slate-300 px-4 text-lg"
                />
              </div>
              <div className="lg:col-span-2">
                <Label
                  htmlFor="days"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Duration (days)
                </Label>
                <Input
                  id="days"
                  type="number"
                  min={1}
                  max={14}
                  value={days}
                  onChange={(e) => {
                    setDays(e.target.value);
                    setHasManualSwaps(false);
                  }}
                  className="mt-2 min-h-14 rounded-xl border-slate-300 px-4 text-lg"
                />
              </div>
              <div className="lg:col-span-3">
                <Label
                  htmlFor="pace"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Travel pace
                </Label>
                <select
                  id="pace"
                  value={pace}
                  onChange={(e) => {
                    setPace(e.target.value as Pace);
                    setHasManualSwaps(false);
                  }}
                  className="mt-2 flex h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-lg"
                >
                  <option value="relaxed">Balanced Discovery</option>
                  <option value="moderate">Moderate Explorer</option>
                  <option value="packed">Packed Adventure</option>
                </select>
              </div>
            </div>

            <div className="mt-6">
              <Label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Ranking style
              </Label>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant={rankingStyle === "most_popular" ? "default" : "outline"}
                  className={cn(
                    "h-12 rounded-xl px-6 text-base",
                    rankingStyle === "most_popular" && "bg-[#031a45] text-white hover:bg-[#05235b]"
                  )}
                  onClick={() => {
                    setRankingStyle("most_popular");
                    setHasManualSwaps(false);
                  }}
                >
                  Most popular
                </Button>
                <Button
                  type="button"
                  variant={rankingStyle === "best_spread" ? "default" : "outline"}
                  className="h-12 rounded-xl px-6 text-base"
                  onClick={() => {
                    setRankingStyle("best_spread");
                    setHasManualSwaps(false);
                  }}
                >
                  Best spread
                </Button>
                <Button
                  type="button"
                  variant={rankingStyle === "hidden_gems" ? "default" : "outline"}
                  className="h-12 rounded-xl px-6 text-base"
                  onClick={() => {
                    setRankingStyle("hidden_gems");
                    setHasManualSwaps(false);
                  }}
                >
                  Hidden gems
                </Button>
              </div>
            </div>
          </div>

          {suggesting && <p className="mt-3 text-xs text-slate-500">Searching places...</p>}
          {results.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-xl border bg-white">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setDestination({
                      mapboxId: r.id,
                      name: r.name,
                      country: "",
                      lat: r.lat ?? 0,
                      lng: r.lng ?? 0,
                      suggestedDays: Number.parseInt(days, 10) || 3,
                    });
                    setQuery(r.name);
                    setResults([]);
                    setSelectedStops([]);
                    setAlternativeStops([]);
                    setHasManualSwaps(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                >
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <span className="min-w-0">
                    <span className="block truncate">{r.name}</span>
                    {r.fullName && r.fullName !== r.name ? (
                      <span className="block truncate text-xs text-slate-500">{r.fullName}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">Area coverage suggestions</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadAreaSuggestions()}
              disabled={loadingPreview}
            >
              {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Selected points are used for the trip. Swap with alternatives to customize.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-semibold text-slate-700">Selected points</p>
              <div className="max-h-52 space-y-1.5 overflow-auto">
                {selectedStops.map((s, idx) => (
                  <button
                    key={`${s.name}-${s.lat}-${s.lng}`}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={`w-full rounded-md border px-2.5 py-2 text-left text-sm ${
                      idx === selectedIndex ? "border-blue-500 bg-blue-50" : "border-slate-200"
                    }`}
                  >
                    <div className="truncate">{s.name}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {typeof s.popularityScore === "number"
                        ? `Popularity ${s.popularityScore.toFixed(1)}`
                        : "Popularity n/a"}
                      {s.category ? ` • ${s.category.replace(/_/g, " ")}` : ""}
                    </div>
                  </button>
                ))}
                {selectedStops.length === 0 && (
                  <p className="text-xs text-slate-500">Pick destination to load.</p>
                )}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-semibold text-slate-700">
                Popular alternatives in this area
              </p>
              <div className="max-h-52 space-y-1.5 overflow-auto">
                {alternativeStops.map((s, idx) => (
                  <div
                    key={`${s.name}-${s.lat}-${s.lng}`}
                    className="rounded-md border border-slate-200 px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-800">{s.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {typeof s.popularityScore === "number"
                            ? `Popularity ${s.popularityScore.toFixed(1)}`
                            : "Popularity n/a"}
                          {s.category ? ` • ${s.category.replace(/_/g, " ")}` : ""}
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => swapWithAlternative(idx)}>
                        Swap
                      </Button>
                    </div>
                  </div>
                ))}
                {alternativeStops.length === 0 && (
                  <p className="text-xs text-slate-500">No alternatives loaded yet.</p>
                )}
              </div>
            </div>
          </div>
          </div>

          <div className="mt-7 flex justify-end">
            <Button
              onClick={() => void handleGenerate()}
              disabled={loading}
              className="h-14 rounded-full bg-[#031a45] px-10 text-xl font-semibold text-white hover:bg-[#05235b]"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate itinerary
            </Button>
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-4xl font-bold tracking-tight text-slate-900">Popular destinations</h2>
              <p className="mt-1 text-lg text-slate-600">
                Recommended cities near your current location or frequent searches.
              </p>
            </div>
            <button
              type="button"
              className="hidden items-center gap-1 text-sm font-semibold text-slate-700 md:flex"
            >
              View all
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {popularByLocation.map((d) => {
              const key = `${d.name}-${d.country}`;
              const creating = loadingPopularKey === key;
              const selected =
                destination?.name === d.name &&
                destination?.country === d.country &&
                days === String(d.suggestedDays);
              return (
              <button
                key={`${d.name}-${d.country}`}
                type="button"
                onClick={() => void createPopularTrip(d)}
                disabled={Boolean(loadingPopularKey)}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                  selected && "border-[#031a45] ring-2 ring-[#031a45]/15",
                  loadingPopularKey && "cursor-wait opacity-80"
                )}
              >
                <div className="relative">
                  <img
                    src={destinationPreviewImage(d.name)}
                    alt={`${d.name} preview`}
                    className="h-32 w-full object-cover"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#031a45] shadow-sm">
                    {d.suggestedDays} day{d.suggestedDays === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-xl font-semibold text-slate-900">{d.name}</p>
                  <p className="text-sm text-slate-500">{d.country}</p>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    <span>{creating ? "Creating trip..." : `${d.suggestedDays}-day trip plan`}</span>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </div>
              </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
