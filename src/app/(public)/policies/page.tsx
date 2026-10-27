export const metadata = { title: "Website policies" };

const SECTIONS: [string, string, string[]][] = [
  [
    "terms",
    "Terms of use",
    [
      "Carbon Wallet is a free citizen service for households in India. It is not a government website and does not act for any government department.",
      "Figures are estimates worked out from your bills, the items shops register to your home and published emission factors; they are for information and are not a legal or tax document. Sealed monthly records show what was recorded, not that a figure is free of error.",
      "Government schemes are summarised from official sources with the date they were checked. Always apply on the official portal or with the dealer; never pay anyone who promises to get you a subsidy.",
      "Shops may register only what a customer actually bought, after scanning the customer's own card. Misuse leads to suspension.",
    ],
  ],
  [
    "privacy",
    "Privacy in short",
    [
      "We keep only what the service needs: your name and email, your home's bills and items, and a rough area for your home (an H3 hexagon about 120 m across, never the exact point).",
      "Area totals are published only from 20 homes, so no single home can be picked out. Shops see only your home's name, city, Carbon ID and a colour, never your numbers.",
      "Bills and photos are encrypted at rest. You can download everything we hold about you, or delete your account, from Settings. Full notice: /privacy.",
    ],
  ],
  [
    "accessibility",
    "Accessibility statement",
    [
      "We aim to meet the Guidelines for Indian Government Websites (GIGW 3.0) and WCAG 2.1 level AA.",
      "Available on every page: a skip-to-content link, three text sizes (A, A+, A++), English and Hindi, full keyboard use, visible focus, labels on every control, text alternatives for images and charts, colour never used alone, and reduced motion when your device asks for it. Moving text (the What's new strip) can be paused.",
      "If something doesn't work for you, file it from Help & complaints and we will fix it or give you the information another way.",
    ],
  ],
  [
    "hyperlinking",
    "Hyperlinking policy",
    [
      "You may link to any public page of Carbon Wallet without asking. Please don't load our pages inside frames on your site.",
      "Links from Carbon Wallet to other websites, including government portals, are for your convenience; we are not responsible for their content.",
    ],
  ],
  [
    "copyright",
    "Copyright policy",
    [
      "Open data on the Open data page may be reused freely with attribution to Carbon Wallet. Map data © OpenStreetMap contributors (ODbL). Weather and air quality from Open-Meteo.",
      "Product photos in shop catalogues belong to the shops that uploaded them.",
    ],
  ],
  [
    "content-review",
    "Content review",
    [
      "Scheme terms are re-checked on their official sources and each shows the date it was last checked. Emission factors are reviewed when the Central Electricity Authority publishes a new CO₂ baseline.",
    ],
  ],
];

export default function PoliciesPage() {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr]">
      <nav aria-label="On this page" className="lg:sticky lg:top-16 lg:self-start">
        <p className="label-caps">On this page</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-[14px]">
          {SECTIONS.map(([id, title]) => (
            <li key={id}>
              <a href={`#${id}`} className="underline-offset-2 hover:text-gov-blue hover:underline">
                {title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex flex-col gap-10">
        <header className="border-b-[3px] border-gov-saffron pb-4">
          <span className="label-caps">Website policies</span>
          <h1 className="mt-1.5 font-heading text-4xl font-medium tracking-tight">Policies</h1>
          <p className="mt-2 text-[14px] text-ink-muted">Last reviewed 26 October 2026.</p>
        </header>
        {SECTIONS.map(([id, title, paras]) => (
          <section key={id} id={id} className="scroll-mt-20">
            <h2 className="font-heading text-2xl font-medium">{title}</h2>
            {paras.map((p, i) => (
              <p key={i} className="mt-2 max-w-3xl text-[15px] leading-relaxed">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
