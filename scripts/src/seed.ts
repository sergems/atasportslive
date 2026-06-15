import bcrypt from "bcrypt";
import { db } from "@workspace/db";
import {
  usersTable,
  walletsTable,
  streamsTable,
  gamesTable,
} from "@workspace/db";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create admin user
  const adminHash = await bcrypt.hash("admin123", 10);
  const [admin] = await db
    .insert(usersTable)
    .values({
      email: "admin@ata.ug",
      passwordHash: adminHash,
      fullName: "ATA Admin",
      phone: "0700000000",
      role: "admin",
      status: "active",
    })
    .onConflictDoNothing()
    .returning();

  if (admin) {
    await db
      .insert(walletsTable)
      .values({ userId: admin.id, balance: "10000", availableBalance: "10000", withdrawableBalance: "10000" })
      .onConflictDoNothing();
    console.log("✅ Admin user created: admin@ata.ug / admin123");
  }

  // Create demo user
  const userHash = await bcrypt.hash("demo123", 10);
  const [demoUser] = await db
    .insert(usersTable)
    .values({
      email: "demo@ata.ug",
      passwordHash: userHash,
      fullName: "Demo User",
      phone: "0771234567",
      role: "user",
      status: "active",
    })
    .onConflictDoNothing()
    .returning();

  if (demoUser) {
    await db
      .insert(walletsTable)
      .values({ userId: demoUser.id, balance: "50", availableBalance: "50", withdrawableBalance: "50" })
      .onConflictDoNothing();
    console.log("✅ Demo user created: demo@ata.ug / demo123");
  }

  // Create sample streams
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  await db.insert(streamsTable).values([
    {
      title: "Kampala Pool Championship - Quarter Finals",
      description: "Top pool players from Kampala face off in the quarter final round.",
      sport: "pool",
      thumbnailUrl: "https://images.unsplash.com/photo-1615672968435-75e0c291cd6e?w=800&q=80",
      status: "live",
      hlsUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      startTime: yesterday,
      accessPrice: "1.50",
      viewerCount: 142,
    },
    {
      title: "Lugogo Boxing Night - Main Event",
      description: "Heavyweight showdown at Lugogo Arena. The main event you've been waiting for.",
      sport: "boxing",
      thumbnailUrl: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&q=80",
      status: "upcoming",
      startTime: tomorrow,
      accessPrice: "1.50",
    },
    {
      title: "Kyebando Pool League - Finals",
      description: "The best pool players in Kyebando compete for the league title.",
      sport: "pool",
      thumbnailUrl: "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&q=80",
      status: "upcoming",
      startTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      accessPrice: "1.50",
    },
    {
      title: "Nakawa Boxing Club Showcase",
      description: "Young boxing talents from Nakawa show what they've got.",
      sport: "boxing",
      thumbnailUrl: "https://images.unsplash.com/photo-1565846930803-a7e4a6b7e5e4?w=800&q=80",
      status: "ended",
      startTime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      accessPrice: "1.50",
    },
  ]).onConflictDoNothing();
  console.log("✅ Sample streams created");

  // Create sample games
  const todayDate = now.toISOString().split("T")[0];
  const tomorrowDate = tomorrow.toISOString().split("T")[0];
  const nextWeekDate = nextWeek.toISOString().split("T")[0];

  await db.insert(gamesTable).values([
    {
      sport: "pool",
      playerA: "Hassan Mukasa",
      playerB: "David Ssemwanga",
      eventDate: todayDate,
      eventTime: "19:00",
      status: "live",
      openBetsCount: 5,
      matchedBetsCount: 3,
      totalBetPool: "90.00",
    },
    {
      sport: "boxing",
      playerA: "Moses Nkosi",
      playerB: "Emmanuel Atiku",
      eventDate: tomorrowDate,
      eventTime: "20:00",
      status: "upcoming",
    },
    {
      sport: "pool",
      playerA: "Brian Lubega",
      playerB: "Patrick Okello",
      eventDate: tomorrowDate,
      eventTime: "15:00",
      status: "upcoming",
    },
    {
      sport: "boxing",
      playerA: "Joseph Kato",
      playerB: "Richard Wanyama",
      eventDate: nextWeekDate,
      eventTime: "18:00",
      status: "upcoming",
    },
    {
      sport: "pool",
      playerA: "Samuel Kagwa",
      playerB: "Alex Mutumba",
      eventDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      eventTime: "17:00",
      status: "completed",
      result: "player_a_wins",
      matchedBetsCount: 8,
      totalBetPool: "240.00",
    },
  ]).onConflictDoNothing();
  console.log("✅ Sample games created");

  console.log("🎉 Seeding complete!");
  console.log("\nDemo accounts:");
  console.log("  Admin: admin@ata.ug / admin123");
  console.log("  User:  demo@ata.ug / demo123");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
