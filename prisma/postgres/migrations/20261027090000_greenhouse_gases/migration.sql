-- All greenhouse gases: each month keeps its split by gas (kg CO2e of CO2, CH4, N2O, HFCs, and food/travel as CO2e)
ALTER TABLE "monthly_summaries" ADD COLUMN "by_gas" TEXT NOT NULL DEFAULT '{}';
