/**
 * Developer seed: creates the demo studio with two events, generated photos and
 * one client selection, so the dashboard has something to show without going
 * through registration.
 *
 *   npm run db:demo
 *
 * Safe to re-run: it wipes only the demo studio's events and rebuilds them.
 */
import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ROOT = process.env.STORAGE_ROOT || path.join(process.cwd(), "storage");
const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@picdeck.local";

type Card = { title: string; subtitle: string; from: string; to: string };

const EVENTS: {
  title: string;
  client: string;
  phone: string;
  email: string;
  note: string;
  date: string;
  limit: number | null;
  cards: Card[];
}[] = [
  {
    title: "Ananya & Rohan — Reception",
    client: "Ananya",
    phone: "+919812345678",
    email: "ananya@example.com",
    note: "Please pick 2 photos for the album.",
    date: "2026-11-20",
    limit: 2,
    cards: [
      { title: "Varmala", subtitle: "01", from: "#f5dfc8", to: "#c98d67" },
      { title: "First Dance", subtitle: "02", from: "#dfe9f7", to: "#7b95c7" },
      { title: "Mandap", subtitle: "03", from: "#e4f2e4", to: "#7fa98a" },
      { title: "Sangeet", subtitle: "04", from: "#f6e2ea", to: "#c4849d" },
    ],
  },
  {
    title: "Meera & Arjun — Haldi",
    client: "Meera",
    phone: "+919833445566",
    email: "meera@example.com",
    note: "Shortlist 6 favourites for the pre-wedding shoot.",
    date: "2026-10-04",
    limit: 6,
    cards: [
      { title: "Haldi Splash", subtitle: "01", from: "#fbeec0", to: "#e0b13f" },
      { title: "Couple Portrait", subtitle: "02", from: "#e8e0f6", to: "#9480c2" },
      { title: "Family", subtitle: "03", from: "#e2f0f6", to: "#7ba7bd" },
      { title: "Candid", subtitle: "04", from: "#f6e6de", to: "#bd8b72" },
      { title: "Details", subtitle: "05", from: "#e9efe3", to: "#8ea47c" },
    ],
  },
];

async function makeJpeg(card: Card) {
  const width = 1200;
  const height = 800;
  const escape = (value: string) =>
    value.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);
  const label = escape(card.title);
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${card.from}"/>
          <stop offset="100%" stop-color="${card.to}"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#g)"/>
      <circle cx="950" cy="170" r="120" fill="rgba(255,255,255,0.28)"/>
      <circle cx="180" cy="660" r="90" fill="rgba(255,255,255,0.18)"/>
      <text x="80" y="470" font-family="Georgia, serif" font-size="92" fill="rgba(255,255,255,0.92)">${label}</text>
      <text x="84" y="540" font-family="Helvetica, Arial" font-size="30" letter-spacing="8" fill="rgba(255,255,255,0.75)">PICDECK SAMPLE ${escape(card.subtitle)}</text>
    </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

/** A short, gentle piano-ish chord bed so the demo flipbook has real audio. */
async function writeMusic(filePath: string) {
  const sampleRate = 22050;
  const seconds = 24;
  const total = sampleRate * seconds;
  const data = Buffer.alloc(total * 2);
  const chords = [
    [261.63, 329.63, 392.0],
    [246.94, 311.13, 369.99],
    [220.0, 277.18, 329.63],
    [196.0, 246.94, 293.66],
  ];
  for (let i = 0; i < total; i += 1) {
    const t = i / sampleRate;
    const chord = chords[Math.floor(t / 6) % chords.length];
    let value = 0;
    for (const frequency of chord) {
      value += Math.sin(2 * Math.PI * frequency * t) * 0.16;
      value += Math.sin(2 * Math.PI * frequency * 2 * t) * 0.03;
    }
    const envelope = 0.55 + 0.45 * Math.sin(Math.PI * ((t % 6) / 6));
    const fade = Math.min(1, t / 1.5, (seconds - t) / 1.5);
    const sample = Math.max(-1, Math.min(1, value * envelope * fade));
    data.writeInt16LE(Math.round(sample * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  await fs.writeFile(filePath, Buffer.concat([header, data]));
}

/** Burns the studio watermark into seeded previews, matching real uploads. */
async function watermarkPreviews(eventId: string, text: string) {
  const previewDir = path.join(ROOT, "events", eventId, "preview");
  const files = await fs.readdir(previewDir).catch(() => [] as string[]);
  await Promise.all(
    files.map(async (name) => {
      const file = path.join(previewDir, name);
      const meta = await sharp(file).metadata();
      const width = meta.width ?? 1600;
      const fontSize = Math.max(18, Math.round(width * 0.022));
      const svg = `<svg width="${width}" height="${fontSize * 2.4}" xmlns="http://www.w3.org/2000/svg">
        <text x="${fontSize}" y="${fontSize * 1.5}" text-anchor="start"
          font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}"
          fill="white" fill-opacity="0.62" stroke="black" stroke-opacity="0.28" stroke-width="1.5">${text}</text>
      </svg>`;
      const buffer = await sharp(file)
        .composite([{ input: Buffer.from(svg), gravity: "southwest" }])
        .webp({ quality: 82 })
        .toBuffer();
      await fs.writeFile(file, buffer);
    }),
  );
}

async function addPhoto(eventId: string, card: Card, index: number) {
  const buffer = await makeJpeg(card);
  const filename = `demo-${index + 1}-${crypto.randomUUID().slice(0, 8)}.jpg`;
  const base = path.join(ROOT, "events", eventId);
  await Promise.all(
    ["orig", "thumb", "preview"].map((dir) => fs.mkdir(path.join(base, dir), { recursive: true })),
  );

  await fs.writeFile(path.join(base, "orig", filename), buffer);
  const thumbName = `${filename}.webp`;
  await sharp(buffer)
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(path.join(base, "thumb", thumbName));
  await sharp(buffer)
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(base, "preview", thumbName));

  const meta = await sharp(buffer).metadata();
  const photo = await prisma.photo.create({
    data: {
      eventId,
      filename,
      originalName: `${card.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.jpg`,
      mimeType: "image/jpeg",
      sizeBytes: buffer.byteLength,
      width: meta.width ?? null,
      height: meta.height ?? null,
      thumbPath: path.posix.join("events", eventId, "thumb", thumbName),
      previewPath: path.posix.join("events", eventId, "preview", thumbName),
    },
  });

  // Index for the demo face/similarity search, same as a real upload would.
  const { descriptorFor } = await import("../src/lib/face");
  const vector = await descriptorFor(buffer);
  if (vector) {
    await prisma.faceDescriptor.create({
      data: { photoId: photo.id, vector: JSON.stringify(vector) },
    });
  }

  return photo;
}

function galleryCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

async function uniqueCode() {
  for (let i = 0; i < 30; i += 1) {
    const code = galleryCode();
    if (!(await prisma.event.findUnique({ where: { galleryCode: code } }))) return code;
  }
  throw new Error("Could not allocate a gallery code");
}

async function main() {
  // The demo seed must be re-runnable even when another studio already grabbed
  // the short demo codes (a fresh dev DB often reuses them).
  const codeClash = await prisma.user.findFirst({
    where: { referralCode: "DEMO01", NOT: { email: DEMO_EMAIL } },
    select: { id: true },
  });
  const studioClash = await prisma.user.findFirst({
    where: { studioCode: "demo-studio", NOT: { email: DEMO_EMAIL } },
    select: { id: true },
  });

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: "Demo Studio" },
    create: {
      name: "Demo Studio",
      email: DEMO_EMAIL,
      phone: "+919000000000",
      passwordHash: "demo-not-a-real-password",
      profession: "photographer",
      city: "Jaipur",
      referralCode: codeClash ? "DEMO02" : "DEMO01",
      phoneVerifiedAt: new Date(),
    },
  });

  // Studio branding: a real logo file, a text watermark and the all-events code.
  const siteDir = path.join(ROOT, "sites", user.id);
  await fs.mkdir(siteDir, { recursive: true });
  const logoSvg = `<svg width="480" height="120" xmlns="http://www.w3.org/2000/svg">
    <rect width="480" height="120" rx="16" fill="none"/>
    <circle cx="60" cy="60" r="34" fill="#0f766e"/>
    <text x="60" y="73" text-anchor="middle" font-family="Georgia, serif" font-size="36" fill="#ffffff">D</text>
    <text x="112" y="56" font-family="Georgia, serif" font-size="34" fill="#0f172a">Demo Studio</text>
    <text x="113" y="84" font-family="Helvetica, Arial, sans-serif" font-size="14" letter-spacing="6" fill="#64748b">JAIPUR</text>
  </svg>`;
  await sharp(Buffer.from(logoSvg)).png().toFile(path.join(siteDir, "logo.png"));
  await prisma.user.update({
    where: { id: user.id },
    data: {
      studioCode: studioClash ? "demo-studio-2" : "demo-studio",
      watermarkText: "Demo Studio · proof",
      logoPath: path.posix.join("sites", user.id, "logo.png"),
      // Invoice numbering/letterhead the demo can show without extra setup.
      invoicePrefix: "DS",
      invoiceTerms: JSON.stringify([
        "50% advance to confirm the date",
        "Balance due on delivery of the album",
        "Travel outside Jaipur billed separately",
      ]),
    },
  });

  // The demo studio is on Gold so every module is visible in the showcase.
  const demoPlan = await prisma.plan.findUnique({ where: { slug: "gold-yearly" } });
  if (demoPlan) {
    const subscription = await prisma.subscription.findFirst({ where: { userId: user.id } });
    const data = {
      planId: demoPlan.id,
      status: "ACTIVE",
      endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    };
    if (subscription) {
      await prisma.subscription.update({ where: { id: subscription.id }, data });
    } else {
      await prisma.subscription.create({ data: { userId: user.id, ...data } });
    }
  }

  // Rebuild the demo events from scratch so re-running this script is safe.
  const existing = await prisma.event.findMany({ where: { userId: user.id } });
  for (const event of existing) {
    await prisma.event.delete({ where: { id: event.id } });
    await fs.rm(path.join(ROOT, "events", event.id), { recursive: true, force: true });
  }

  const created: {
    id: string;
    title: string;
    client: string;
    phone: string;
    code: string;
    photoIds: string[];
  }[] = [];
  const codes: string[] = [];
  for (const spec of EVENTS) {
    const event = await prisma.event.create({
      data: {
        userId: user.id,
        title: spec.title,
        eventDate: new Date(spec.date),
        clientName: spec.client,
        clientPhone: spec.phone,
        clientEmail: spec.email,
        note: spec.note,
        selectionLimit: spec.limit,
        downloadEnabled: true,
        originalDownloadEnabled: false,
        galleryCode: await uniqueCode(),
      },
    });

    const photos = [];
    for (let i = 0; i < spec.cards.length; i += 1) {
      photos.push(await addPhoto(event.id, spec.cards[i], i));
    }

    // Demo face groups: name the first clusters so name search has something to show.
    const tags = spec === EVENTS[0]
      ? ["Ananya", "Ananya", "Rohan", "Family"]
      : ["Meera", "Arjun", "Family", "Friends", "Details"];
    for (let i = 0; i < photos.length; i += 1) {
      await prisma.faceDescriptor.updateMany({
        where: { photoId: photos[i].id },
        data: { tag: tags[i] ?? "Family" },
      });
    }

    await watermarkPreviews(event.id, "Demo Studio · proof");

    // The first event already has a client submission, the second is pending.
    if (spec === EVENTS[0]) {
      await prisma.selection.createMany({
        data: photos.slice(0, 2).map((photo) => ({
          eventId: event.id,
          photoId: photo.id,
          clientName: spec.client,
          clientPhone: spec.phone,
        })),
      });
    }

    codes.push(`${event.galleryCode}  ${spec.title}  (/g/${event.galleryCode})`);
    created.push({
      id: event.id,
      title: spec.title,
      client: spec.client,
      phone: spec.phone,
      code: event.galleryCode,
      photoIds: photos.map((photo) => photo.id),
    });
  }

  // ── Sample data for the rest of the suite ──────────────────────────────────
  // Rebuild these too so the demo is idempotent.
  await prisma.notification.deleteMany({ where: { userId: user.id } });
  await prisma.invitation.deleteMany({ where: { userId: user.id } });
  await prisma.invoice.deleteMany({ where: { userId: user.id } });
  const oldAlbums = await prisma.album.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  for (const oldAlbum of oldAlbums) {
    await fs.rm(path.join(ROOT, "albums", oldAlbum.id), { recursive: true, force: true });
  }
  await prisma.album.deleteMany({ where: { userId: user.id } });
  // A previous studio in the same dev DB may still hold the demo slugs; slugs are
  // globally unique, so clear those rows before re-creating them.
  await prisma.album.deleteMany({ where: { slug: "demo-reception-album", NOT: { userId: user.id } } });
  await prisma.invitation.deleteMany({ where: { slug: "demo-ananya-rohan", NOT: { userId: user.id } } });
  await prisma.studioSite.deleteMany({ where: { userId: user.id } });
  await prisma.studioSite.deleteMany({ where: { slug: "demo-studio", NOT: { userId: user.id } } });

  const first = created[0];
  if (first) {
    const [a, b, c, d] = first.photoIds;
    const album = await prisma.album.create({
      data: {
        userId: user.id,
        eventId: first.id,
        slug: "demo-reception-album",
        title: `${first.title} — album`,
        subtitle: "Two spreads, four frames",
        coverPhotoId: a,
        published: true,
        pages: {
          create: [
            { photoAId: a, photoBId: b, position: 0, caption: "The varmala" },
            ...(c ? [{ photoAId: c, photoBId: d ?? null, position: 1, caption: "The mandap" }] : []),
          ],
        },
      },
    });

    // Real cover art and a playable background track for the demo flipbook.
    const albumDir = path.join(ROOT, "albums", album.id);
    await fs.mkdir(albumDir, { recursive: true });
    const coverBuffer = await makeJpeg({
      title: "Ananya & Rohan",
      subtitle: "ALBUM",
      from: "#20304a",
      to: "#8c6a4a",
    });
    await sharp(coverBuffer)
      .resize({ width: 1600, height: 1000, fit: "cover" })
      .webp({ quality: 84 })
      .toFile(path.join(albumDir, "cover.webp"));
    await writeMusic(path.join(albumDir, "music.wav"));
    await prisma.album.update({
      where: { id: album.id },
      data: {
        coverPath: path.posix.join("albums", album.id, "cover.webp"),
        musicPath: path.posix.join("albums", album.id, "music.wav"),
        musicTitle: "Jaipur Evening (demo track)",
      },
    });

    await prisma.invoice.create({
      data: {
        userId: user.id,
        eventId: first.id,
        number: "DS/2026/001",
        type: "INVOICE",
        status: "SENT",
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        clientName: first.client,
        clientPhone: first.phone,
        clientEmail: "client@example.com",
        notes: "50% advance confirms the date. Balance before delivery.",
        functions: JSON.stringify([
          { name: "Haldi", date: "18 Nov 2026", venue: "Bani Park", desc: "Morning, marigold theme" },
          { name: "Wedding", date: "19 Nov 2026", venue: "Rambagh", desc: "Baraat 7 pm" },
          { name: "Reception", date: "20 Nov 2026", venue: "The Leela Palace", desc: "" },
        ]),
        terms: JSON.stringify([
          "50% advance to confirm the date",
          "Balance due on delivery of the album",
        ]),
        discount: 2000,
        extra: 0,
        budgetMode: false,
        budgetAmount: 0,
        subtotal: 120000,
        taxRate: 0,
        taxAmount: 0,
        total: 118000,
        advance: 60000,
        publicToken: "demo-invoice-link-token",
        items: {
          create: [
            {
              description: "Reception coverage — 2 shooters",
              quantity: 2,
              rate: 45000,
              amount: 90000,
              group: "Wedding coverage",
              position: 0,
            },
            {
              description: "Edited album (30 spreads)",
              quantity: 1,
              rate: 30000,
              amount: 30000,
              group: "Deliverables",
              position: 1,
            },
          ],
        },
        payments: {
          create: [
            {
              amount: 40000,
              paidAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
              mode: "UPI",
              note: "Booking advance",
              position: 0,
            },
            {
              amount: 20000,
              paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
              mode: "CASH",
              note: "Second instalment",
              position: 1,
            },
          ],
        },
      },
    });

    await prisma.invitation.create({
      data: {
        userId: user.id,
        slug: "demo-ananya-rohan",
        template: "marigold",
        coupleA: "Ananya",
        coupleB: "Rohan",
        eventDate: new Date("2026-11-20T19:00:00"),
        venue: "The Leela Palace, Jaipur",
        message: "Two families, one evening, and a lot of filter coffee.",
        rsvpCount: 12,
      },
    });

    await prisma.notification.createMany({
      data: [
        {
          userId: user.id,
          eventId: first.id,
          channel: "email",
          toName: first.client,
          toEmail: "ananya@example.com",
          template: "gallery_ready",
          message: `Hi ${first.client}, your photos from ${first.title} are ready to review. Open your gallery and pick your favourites.`,
          status: "SENT",
        },
        {
          userId: user.id,
          eventId: first.id,
          channel: "email",
          toName: first.client,
          toEmail: "ananya@example.com",
          template: "selection_reminder",
          message: `Hi ${first.client}, a gentle reminder to finish picking your photos for ${first.title}.`,
          status: "QUEUED",
        },
        {
          userId: user.id,
          eventId: first.id,
          channel: "email",
          toName: first.client,
          toPhone: first.phone,
          toEmail: "ananya@example.com",
          template: "gallery_ready",
          message: `Hi ${first.client}, your gallery is ready. Open it here: /g/${first.code}`,
          status: "QUEUED",
        },
      ],
    });

    console.log(`Demo album: /album/${album.slug}`);
  }

  await prisma.studioSite.create({
    data: {
      userId: user.id,
      slug: "demo-studio",
      headline: "Weddings, shot like film — Jaipur & Udaipur",
      about:
        "Ten years of covering north Indian weddings. Two shooters, natural light, no staged smiles.",
      services: JSON.stringify([
        { title: "Full wedding coverage", price: "₹1,20,000", description: "Two days, 500 edited photos, one album" },
        { title: "Pre-wedding shoot", price: "₹35,000", description: "Half day, two locations, 80 edits" },
        { title: "Haldi & mehndi", price: "₹25,000", description: "Single shooter, 150 edits, 48-hour delivery" },
      ]),
      whatsapp: "+919000000000",
      instagram: "@demostudio",
      city: "Jaipur",
      published: true,
    },
  });

  console.log(`Demo studio site: /s/demo-studio`);
  console.log(`Demo invitation: /invite/demo-ananya-rohan`);

  console.log(`Demo studio ready: ${DEMO_EMAIL}`);
  console.log("Gallery codes:");
  for (const line of codes) console.log("  " + line);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());