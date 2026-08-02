"use client";

import {
  Activity,
  ArrowRight,
  Atom,
  Gauge,
  Orbit,
  Search,
  Sparkles,
  Waves,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const simulations = [
  {
    number: "01",
    title: "Free fall",
    description:
      "Compare a dropped ball with a launched one, with or without air resistance.",
    concepts: ["Gravity", "Trajectory", "Drag"],
    status: "Available",
    href: "/simulations/free-fall",
    accent: "orange",
    icon: Gauge,
  },
  {
    number: "02",
    title: "Spring release",
    description:
      "Cut a rope and a massive spring together, then watch how the release wave changes the race to the ground.",
    concepts: ["Waves", "Elasticity", "Gravity"],
    status: "Available",
    href: "/simulations/spring-release",
    accent: "blue",
    icon: Activity,
  },
  {
    number: "03",
    title: "Simple pendulum",
    description:
      "Observe how length and gravity influence the period of an oscillation.",
    concepts: ["Oscillation", "Period", "Energy"],
    status: "Coming soon",
    href: null,
    accent: "blue",
    icon: Waves,
  },
  {
    number: "04",
    title: "Orbital motion",
    description:
      "Explore the balance between velocity, gravitational pull and trajectory.",
    concepts: ["Orbit", "Velocity", "Attraction"],
    status: "Coming soon",
    href: null,
    accent: "violet",
    icon: Orbit,
  },
  {
    number: "05",
    title: "Collisions",
    description:
      "Vary masses and velocities to study the conservation of momentum.",
    concepts: ["Momentum", "Energy", "Mass"],
    status: "Coming soon",
    href: null,
    accent: "green",
    icon: Atom,
  },
] as const;

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("en");
  const filteredSimulations = useMemo(
    () =>
      simulations.filter((simulation) =>
        [
          simulation.title,
          simulation.description,
          ...simulation.concepts,
        ].some((value) =>
          value.toLocaleLowerCase("en").includes(normalizedQuery),
        ),
      ),
    [normalizedQuery],
  );

  useEffect(() => setHydrated(true), []);

  return (
    <main
      className="catalog-shell"
      data-hydrated={hydrated ? "true" : "false"}
    >
      <header className="topbar catalog-topbar">
        <a className="brand" href="/" aria-label="SimuPhys home">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <span>
            <strong>SimuPhys</strong>
            <small>MECHANICS LABORATORY</small>
          </span>
        </a>
        <span className="catalog-count">
          {simulations.filter((simulation) => simulation.href).length} experiment
          available
        </span>
      </header>

      <section className="catalog-hero">
        <div className="catalog-hero-copy">
          <p className="eyebrow">
            <Sparkles size={15} strokeWidth={2.2} />
            Physics brought to life
          </p>
          <h1>Choose your<br />experiment.</h1>
          <p>
            Change the parameters, observe the phenomena and build your
            intuition through interactive simulations.
          </p>
        </div>

        <div className="catalog-orbit" aria-hidden="true">
          <span className="orbit-ring orbit-ring-large" />
          <span className="orbit-ring orbit-ring-small" />
          <span className="orbit-core">g</span>
          <i className="orbit-body orbit-body-orange" />
          <i className="orbit-body orbit-body-blue" />
          <span className="orbit-formula">F = ma</span>
        </div>
      </section>

      <section className="catalog-content" aria-labelledby="catalog-title">
        <div className="catalog-heading-row">
          <div>
            <p>THE LABORATORY</p>
            <h2 id="catalog-title">All simulations</h2>
          </div>

          <label className="catalog-search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Search simulations</span>
            <input
              type="search"
              value={query}
              placeholder="Search simulations…"
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={16} />
              </button>
            )}
          </label>
        </div>

        {filteredSimulations.length > 0 ? (
          <div className="simulation-grid" aria-live="polite">
            {filteredSimulations.map((simulation) => {
              const Icon = simulation.icon;
              const cardContent = (
                <>
                  <div className="catalog-card-topline">
                    <span className="catalog-card-number">
                      EXPERIMENT {simulation.number}
                    </span>
                    <span
                      className={`catalog-status ${simulation.href ? "is-available" : ""}`}
                    >
                      <i />
                      {simulation.status}
                    </span>
                  </div>
                  <div
                    className={`catalog-card-visual visual-${simulation.accent}`}
                  >
                    <Icon size={42} strokeWidth={1.35} />
                    <span className="visual-axis visual-axis-x" />
                    <span className="visual-axis visual-axis-y" />
                    <i className="visual-particle visual-particle-a" />
                    <i className="visual-particle visual-particle-b" />
                  </div>
                  <div className="catalog-card-copy">
                    <h3>{simulation.title}</h3>
                    <p>{simulation.description}</p>
                    <div className="catalog-tags">
                      {simulation.concepts.map((concept) => (
                        <span key={concept}>{concept}</span>
                      ))}
                    </div>
                  </div>
                  <div className="catalog-card-action">
                    <span>
                      {simulation.href ? "Launch experiment" : "In development"}
                    </span>
                    {simulation.href && <ArrowRight size={18} />}
                  </div>
                </>
              );

              return simulation.href ? (
                <a
                  className={`catalog-card card-${simulation.accent}`}
                  href={simulation.href}
                  key={simulation.number}
                >
                  {cardContent}
                </a>
              ) : (
                <article
                  className={`catalog-card card-${simulation.accent} is-disabled`}
                  key={simulation.number}
                >
                  {cardContent}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="catalog-empty" role="status">
            <Search size={28} />
            <h3>No experiments found</h3>
            <p>Try another keyword or explore the entire laboratory.</p>
            <button type="button" onClick={() => setQuery("")}>Show all</button>
          </div>
        )}
      </section>

      <footer className="catalog-footer">
        <span>SimuPhys • Learn physics through experimentation</span>
        <span>DIGITAL LABORATORY • 2026</span>
      </footer>
    </main>
  );
}
