import { useState, useEffect, useCallback } from "react";

const INITIAL_VEHICLES = [
  {
    id: "bus1",
    type: "bus",
    label: "Route 12 — Bhubaneswar Central",
    route: "12",
    lat: 20.3476,
    lng: 85.7457,
    speed: 0.0005,
    direction: 1,
    status: "In Service",
    passengers: 28,
    maxPassengers: 50,
    nextStop: "Kalpana Square",
    driver: "Ramesh K.",
    lastUpdated: Date.now(),
  },
  {
    id: "auto1",
    type: "auto",
    label: "Auto — Sector 6 Run",
    route: "A1",
    lat: 20.3000,
    lng: 85.8000,
    speed: 0.001,
    direction: 1,
    status: "In Service",
    passengers: 2,
    maxPassengers: 3,
    nextStop: "Sector 6 Market",
    driver: "Prasad R.",
    lastUpdated: Date.now(),
  },
];

// 🎯 Movement engine
function moveVehicle(v) {
  const drift = () => (Math.random() - 0.5) * 0.0002;

  let newLat = v.lat + v.speed * v.direction + drift();
  let newLng = v.lng + v.speed * 0.5 * v.direction + drift();
  let newDirection = v.direction;

  // ✅ Boundary control (lat + lng)
  if (newLat > 20.55 || newLat < 20.20) {
    newDirection *= -1;
    newLat = v.lat;
  }

  if (newLng > 85.90 || newLng < 85.60) {
    newDirection *= -1;
    newLng = v.lng;
  }

  // 🎯 Passenger simulation
  const delta = Math.floor((Math.random() - 0.4) * 3);
  const newPassengers = Math.min(
    v.maxPassengers,
    Math.max(0, v.passengers + delta)
  );

  // 🎯 Speed variation
  const newSpeed = Math.max(
    0.0002,
    Math.min(0.0015, v.speed + (Math.random() - 0.5) * 0.0001)
  );

  // 🎯 Status logic
  let newStatus = "In Service";
  if (newSpeed < 0.0003) newStatus = "Slow";
  if (Math.random() < 0.02) newStatus = "Delayed";

  return {
    ...v,
    lat: newLat,
    lng: newLng,
    direction: newDirection,
    speed: newSpeed,
    passengers: newPassengers,
    status: newStatus,
    lastUpdated: Date.now(),
  };
}

export function useBusTracking() {
  const [vehicles, setVehicles] = useState(INITIAL_VEHICLES);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [isPaused, setIsPaused] = useState(false);

  // 🔥 Faster + smoother updates
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setVehicles((prev) => prev.map(moveVehicle));
    }, 1000); // 🔥 smoother than 2000

    return () => clearInterval(interval);
  }, [isPaused]);

  // 🎯 Derived data
  const filteredVehicles =
    filter === "all"
      ? vehicles
      : vehicles.filter((v) => v.type === filter);

  const selectedVehicle =
    vehicles.find((v) => v.id === selectedId) || null;

  const stats = {
    total: vehicles.length,
    buses: vehicles.filter((v) => v.type === "bus").length,
    autos: vehicles.filter((v) => v.type === "auto").length,
    totalPassengers: vehicles.reduce((sum, v) => sum + v.passengers, 0),
    active: vehicles.filter((v) => v.status === "In Service").length,
    delayed: vehicles.filter((v) => v.status === "Delayed").length,
  };

  // 🎯 Actions
  const selectVehicle = useCallback((id) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const changeFilter = useCallback((type) => {
    setFilter(type);
    setSelectedId(null);
  }, []);

  return {
    vehicles,
    filteredVehicles,
    selectedId,
    selectedVehicle,
    stats,
    filter,
    isPaused,
    selectVehicle,
    togglePause,
    changeFilter,
  };
}