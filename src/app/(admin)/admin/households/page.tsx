"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Users,
  Search,
  LayoutGrid,
  Table,
  Check,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
} from "lucide-react";

interface HouseholdListItem {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  size: number;
  homeType: string;
  floorAreaM2: number;
  joinCode: string;
  status: string;
  currentEmissions: number;
  score: number;
  memberCount: number;
}

export default function HouseholdsPage() {
  const { activeHouseholdId, setActiveHouseholdId, demoRole } = useAppStore();
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [searchQuery, setSearchQuery] = useState("");
  // ?q= opens the list already filtered (the carbon map links here)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearchQuery(q);
  }, []);
  const [stateFilter, setStateFilter] = useState("all");
  const [sizeBandFilter, setSizeBandFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name_asc");
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const [households, setHouseholds] = useState<HouseholdListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchHouseholds() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
          sort: sortBy,
        });
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        if (stateFilter !== "all") params.set("state", stateFilter);
        if (sizeBandFilter !== "all") params.set("sizeBand", sizeBandFilter);

        const res = await fetch(`/api/households?${params.toString()}`, {
          headers: { "x-demo-role": demoRole },
        });
        if (res.ok) {
          const data = await res.json();
          setHouseholds(data.households || []);
          setTotal(data.total || 0);
          setTotalPages(data.totalPages || 1);
        }
      } catch (e) {
        console.error("Failed to load households:", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchHouseholds();
  }, [page, sortBy, searchQuery, stateFilter, sizeBandFilter, demoRole]);

  // Reset page when filter changes
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
  };

  const handleStateChange = (val: string) => {
    setStateFilter(val);
    setPage(1);
  };

  const handleSizeChange = (val: string) => {
    setSizeBandFilter(val);
    setPage(1);
  };

  const startRecord = (page - 1) * pageSize + 1;
  const endRecord = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-secondary" />
            <h1 className="font-heading text-2xl font-medium text-ink">
              Household Master Directory ({total})
            </h1>
          </div>
          <p className="text-xs text-ink-muted">
            Multi-tenant portfolio directory: Select any household to switch active ledger telemetry
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-canvas-card p-0.5 shadow-tier-1">
            <button
              onClick={() => setViewMode("cards")}
              className={`rounded p-1.5 transition-colors ${
                viewMode === "cards" ? "bg-primary text-white" : "text-ink-muted hover:text-ink"
              }`}
              title="Cards View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`rounded p-1.5 transition-colors ${
                viewMode === "table" ? "bg-primary text-white" : "text-ink-muted hover:text-ink"
              }`}
              title="Table View"
            >
              <Table className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-canvas-card border-border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search name, city, state..."
                className="w-56 rounded-lg border border-border bg-canvas-card pl-8 pr-3 py-1.5 text-xs text-ink outline-none focus:border-primary"
              />
            </div>

            {/* State filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-ink-muted" />
              <select
                value={stateFilter}
                onChange={(e) => handleStateChange(e.target.value)}
                className="rounded-lg border border-border bg-canvas-card px-2.5 py-1.5 text-xs text-ink outline-none"
              >
                <option value="all">All States</option>
                <option value="Uttar Pradesh">Uttar Pradesh</option>
                <option value="Delhi">Delhi</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="Karnataka">Karnataka</option>
                <option value="Rajasthan">Rajasthan</option>
                <option value="Haryana">Haryana</option>
                <option value="Tamil Nadu">Tamil Nadu</option>
                <option value="West Bengal">West Bengal</option>
              </select>
            </div>

            {/* Size Band filter */}
            <select
              value={sizeBandFilter}
              onChange={(e) => handleSizeChange(e.target.value)}
              className="rounded-lg border border-border bg-canvas-card px-2.5 py-1.5 text-xs text-ink outline-none"
            >
              <option value="all">All Household Sizes</option>
              <option value="small">Small (1-3 members)</option>
              <option value="medium">Medium (4-5 members)</option>
              <option value="large">Large (6+ members)</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-3.5 w-3.5 text-ink-muted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-border bg-canvas-card px-2.5 py-1.5 text-xs text-ink outline-none font-medium"
            >
              <option value="name_asc">Name: A to Z</option>
              <option value="name_desc">Name: Z to A</option>
              <option value="emissions_asc">Emissions: Lowest First</option>
              <option value="emissions_desc">Emissions: Highest First</option>
              <option value="score_desc">Carbon Index: Highest First</option>
              <option value="score_asc">Carbon Index: Lowest First</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : households.length === 0 ? (
        <Card className="p-12 text-center text-ink-muted">
          <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm font-semibold">No matching households found</p>
          <p className="text-xs text-slate-400">Try adjusting your search criteria or clearing filters</p>
        </Card>
      ) : viewMode === "cards" ? (
        /* View 1: Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {households.map((h) => {
            const isSelected = h.id === activeHouseholdId;
            return (
              <Card
                key={h.id}
                className={`flex flex-col justify-between p-5 transition-all cursor-pointer ${
                  isSelected
                    ? "border-primary ring-2 ring-emerald-500/30 bg-emerald-50/20"
                    : "hover:border-border-hover"
                }`}
                onClick={() => setActiveHouseholdId(h.id)}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-ink-muted">
                      {h.city}, {h.state}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold border tabular-nums ${
                        h.score >= 85
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : h.score >= 70
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-100 text-amber-800 border-amber-300"
                      }`}
                    >
                      Score {h.score}
                    </span>
                  </div>

                  <h3 className="font-heading text-base font-medium text-ink mb-1">
                    {h.name}
                  </h3>
                  <p className="text-xs text-ink-muted">
                    {h.size} Members • {h.floorAreaM2} m² • {h.homeType}
                  </p>
                </div>

                <div className="mt-4 border-t border-border pt-3 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-ink-muted">
                      Monthly CO₂e
                    </span>
                    <span className="text-sm font-bold text-primary tabular-nums">
                      {h.currentEmissions} kg
                    </span>
                  </div>

                  <Button
                    variant={isSelected ? "secondary" : "primary"}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveHouseholdId(h.id);
                    }}
                    icon={isSelected ? <Check className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  >
                    {isSelected ? "Active" : "Switch"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* View 2: Table View */
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-canvas-subtle text-[11px] font-mono font-medium uppercase tracking-[0.08em] text-ink-muted">
                <tr>
                  <th className="py-3 px-4">Household Name</th>
                  <th className="py-3 px-4">Territory</th>
                  <th className="py-3 px-4">Family Size</th>
                  <th className="py-3 px-4">Floor Area</th>
                  <th className="py-3 px-4">Monthly Footprint</th>
                  <th className="py-3 px-4">Carbon Index</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-ink">
                {households.map((h) => {
                  const isSelected = h.id === activeHouseholdId;
                  return (
                    <tr
                      key={h.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isSelected ? "bg-emerald-50/40 font-semibold" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              h.score >= 80 ? "bg-secondary" : "bg-primary"
                            }`}
                          />
                          <span>{h.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-ink-muted">{h.city}, {h.state}</td>
                      <td className="py-3 px-4 text-ink-muted">{h.size} persons</td>
                      <td className="py-3 px-4 text-ink-muted tabular-nums">{h.floorAreaM2} m²</td>
                      <td className="py-3 px-4 font-bold text-primary tabular-nums">
                        {h.currentEmissions} kg CO₂e
                      </td>
                      <td className="py-3 px-4">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums">
                          {h.score} pts
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant={isSelected ? "secondary" : "primary"}
                          size="sm"
                          onClick={() => setActiveHouseholdId(h.id)}
                        >
                          {isSelected ? "Active" : "Switch"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination Bar */}
      {total > 0 && (
        <Card className="p-3 bg-canvas-card flex items-center justify-between text-xs text-ink-muted">
          <div>
            Showing <strong className="text-ink">{startRecord}</strong> to{" "}
            <strong className="text-ink">{endRecord}</strong> of{" "}
            <strong className="text-ink">{total}</strong> households
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              icon={<ChevronLeft className="h-4 w-4" />}
            >
              Previous
            </Button>

            <span className="px-2 font-medium text-ink">
              Page {page} of {totalPages}
            </span>

            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              icon={<ChevronRight className="h-4 w-4" />}
            >
              Next
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
