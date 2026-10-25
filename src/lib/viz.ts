// Categorical colours for emission categories. Mirrors `viz` in tailwind.config.ts.
const PALETTE: Record<string, string> = {
  electricity: "#B4532F",
  energy: "#B4532F",
  cooling: "#B4532F",
  transport: "#2F5D7C",
  food: "#9A7B2E",
  diet: "#9A7B2E",
  cooking: "#6E5A8A",
  lpg: "#6E5A8A",
  waste: "#5A7D52",
  flight: "#48443B",
  flights: "#48443B",
  travel: "#48443B",
  shopping: "#8F897D",
  refrigerant: "#3E7C86",
  "ac gas": "#3E7C86",
};

export function categoryColor(category: string): string {
  const key = category.toLowerCase();
  for (const [name, colour] of Object.entries(PALETTE)) {
    if (key.includes(name)) return colour;
  }
  return "#A49C8B";
}
