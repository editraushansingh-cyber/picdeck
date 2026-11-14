import { PrismaClient } from "@prisma/client";
import { ALL_PLANS } from "../src/lib/plans";

const prisma = new PrismaClient();

async function main() {
  for (const plan of ALL_PLANS) {
    const data = {
      name: plan.name,
      priceInr: plan.priceInr,
      periodMonths: plan.periodMonths,
      highlight: plan.highlight ?? null,
      features: JSON.stringify(plan.features),
      sortOrder: plan.sortOrder,
      product: plan.group,
    };
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: data,
      create: { slug: plan.slug, ...data },
    });
  }
  console.log(`Seeded ${ALL_PLANS.length} plans across photo, all-access, album and AI.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
