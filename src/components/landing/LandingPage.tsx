"use client";

import React, { useCallback, useState } from "react";
import { LoadingScreen } from "./LoadingScreen";
import { Cursor, Grain, ScrollProgress, SmoothScroll } from "./Atmosphere";
import { DiscomMarquee, Hero, LandingNav, type Cta } from "./Hero";
import { BillStory } from "./BillStory";
import { HeatHabit, Numbers, PassbookShowcase } from "./Sections";
import { FeatureIndex, ProofDemo } from "./Index";
import { Audience, FinalCta } from "./Outro";
import { CardShowcase } from "./CardShowcase";
import type { PassbookView } from "@/components/passbook/CarbonPassbook";

export function LandingPage({ cta, loggedIn, sample }: { cta: Cta; loggedIn: boolean; sample: PassbookView }) {
  // the hero is remounted when the loading screen lifts, so its entrance plays in view instead of behind it
  const [heroKey, setHeroKey] = useState(0);
  const onLift = useCallback(() => setHeroKey(1), []);
  return (
    <SmoothScroll>
      <LoadingScreen onLift={onLift} />
      <ScrollProgress />
      <Grain />
      <Cursor />
      <LandingNav cta={cta} />
      <main className="bg-canvas text-ink">
        <Hero key={heroKey} cta={cta} />
        <CardShowcase />
        <DiscomMarquee />
        <BillStory />
        <HeatHabit />
        <Numbers />
        <PassbookShowcase sample={sample} />
        <FeatureIndex />
        <ProofDemo />
        <Audience />
      </main>
      <FinalCta cta={cta} loggedIn={loggedIn} />
    </SmoothScroll>
  );
}
