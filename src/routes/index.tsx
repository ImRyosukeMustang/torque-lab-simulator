import { createFileRoute } from "@tanstack/react-router";
import { GameApp } from "@/game/GameApp";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AUTOMECH Prototype 0.1 — Workshop & Dyno Lab" },
      { name: "description", content: "Modify a sports coupe engine, run live dyno pulls and complete engineering contracts." },
      { property: "og:title", content: "AUTOMECH Prototype 0.1 — Workshop & Dyno Lab" },
      { property: "og:description", content: "Modify a sports coupe engine, run live dyno pulls and complete engineering contracts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameApp,
});
