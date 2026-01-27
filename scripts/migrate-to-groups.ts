/**
 * Migration script to add existing maps to "Personal" groups.
 *
 * This script:
 * 1. Finds all users who own maps without a groupId
 * 2. Creates a "Personal" group for each user
 * 3. Adds the user as owner of their Personal group
 * 4. Updates all their maps to belong to that group
 *
 * Run with: npx tsx scripts/migrate-to-groups.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// Load .env file
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        let value = valueParts.join("=");
        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    }
  } catch {
    // .env file not found, rely on existing environment variables
  }
}

loadEnv();
import { eq, isNull, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

// Re-define schema here to avoid import issues
const groupRoleEnum = pgEnum("group_role", ["owner", "admin", "member"]);

const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
});

const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

const groupMembers = pgTable(
  "group_members",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id").notNull(),
    userId: text("user_id").notNull(),
    role: groupRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueUserGroup: unique().on(table.groupId, table.userId),
  })
);

const maps = pgTable("maps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  userId: text("user_id").notNull(),
  groupId: text("group_id"),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const sqlClient = neon(databaseUrl);
  const db = drizzle(sqlClient);

  console.log("Finding users with maps that have no group...");

  // Find all users who own maps without a groupId
  const usersWithOrphanMaps = await db
    .select({
      userId: maps.userId,
      mapCount: sql<number>`count(*)::int`,
    })
    .from(maps)
    .where(isNull(maps.groupId))
    .groupBy(maps.userId);

  if (usersWithOrphanMaps.length === 0) {
    console.log("No maps without groups found. Migration complete!");
    return;
  }

  console.log(
    `Found ${usersWithOrphanMaps.length} users with maps that need migration.`
  );

  for (const { userId, mapCount } of usersWithOrphanMaps) {
    console.log(`\nProcessing user ${userId} (${mapCount} maps)...`);

    // Check if user already has a Personal group
    const existingGroups = await db
      .select()
      .from(groups)
      .where(eq(groups.createdBy, userId));

    const personalGroup = existingGroups.find((g) => g.name === "Personal");

    let groupId: string;

    if (personalGroup) {
      console.log(`  User already has a Personal group: ${personalGroup.id}`);
      groupId = personalGroup.id;
    } else {
      // Create Personal group for user
      groupId = nanoid();
      const now = new Date();

      console.log(`  Creating Personal group: ${groupId}`);

      await db.insert(groups).values({
        id: groupId,
        name: "Personal",
        description: "Your personal maps",
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });

      // Add user as owner of the group
      const memberId = nanoid();
      await db.insert(groupMembers).values({
        id: memberId,
        groupId,
        userId,
        role: "owner",
        joinedAt: now,
      });

      console.log(`  Added user as owner of Personal group`);
    }

    // Update all user's maps without a group to belong to Personal group
    const result = await db
      .update(maps)
      .set({ groupId })
      .where(eq(maps.userId, userId));

    console.log(`  Updated maps to belong to Personal group`);
  }

  console.log("\nMigration complete!");
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
