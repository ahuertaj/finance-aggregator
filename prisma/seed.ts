// Seed the four player identities. Idempotent (upsert by label).
import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const players = [
    { label: "P1", name: "Player 1" },
    { label: "P2", name: "Player 2" },
    { label: "P3", name: "Player 3" },
    { label: "P4", name: "Player 4" },
  ];

  for (const p of players) {
    await prisma.player.upsert({
      where: { label: p.label },
      update: {},
      create: p,
    });
  }
  console.log(`Seeded ${players.length} players (P1–P4).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
