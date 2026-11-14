import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Album QR — PicDeck" };
export const instant = false;

export default async function AlbumQrPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const album = await prisma.album.findFirst({ where: { id, userId: user.id } });
  if (!album) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${appUrl}/album/${album.slug}`;
  const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 640, color: { dark: "#0f172a", light: "#ffffff" } });

  return (
    <div className="mx-auto max-w-xl">
      <Link href={`/dashboard/albums/${album.id}`} className="text-sm text-muted hover:text-ink">
        ← Back to album
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Lifetime memories QR</h1>
      <p className="mt-1 text-sm text-muted">
        Print this on the album box or share it on a card. Anyone who scans it opens the flipbook.
      </p>

      <div className="mt-6 rounded-2xl border border-line bg-white p-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt={`QR code for ${album.title}`} className="mx-auto size-72" />
        <p className="mt-4 font-medium">{album.title}</p>
        <p className="mt-1 break-all text-xs text-muted">{url}</p>
        <a
          href={dataUrl}
          download={`album-${album.slug}-qr.png`}
          className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          Download PNG
        </a>
      </div>

      <p className="mt-4 text-xs text-muted">
        {album.published
          ? "This album is published, so the QR works for clients right now."
          : "This album is unpublished — publish it before handing out the QR."}
      </p>
    </div>
  );
}
