import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { RsvpButton } from "@/components/RsvpButton";

export const instant = false;

const THEMES: Record<string, { bg: string; ink: string; accent: string; ring: string }> = {
  ivory: { bg: "bg-[#fbf7ef]", ink: "text-[#3f3527]", accent: "text-[#9a7b4f]", ring: "border-[#e0d3ba]" },
  marigold: { bg: "bg-[#fff6e5]", ink: "text-[#4a2d0c]", accent: "text-[#c17a12]", ring: "border-[#f0d3a1]" },
  midnight: { bg: "bg-[#10172b]", ink: "text-[#eef2ff]", accent: "text-[#9db4ff]", ring: "border-[#2a3654]" },
  rose: { bg: "bg-[#fdf2f4]", ink: "text-[#4a2230]", accent: "text-[#b25d76]", ring: "border-[#f0cdd5]" },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const invite = await prisma.invitation.findUnique({ where: { slug } });
  if (!invite) return { title: "Invitation — PicDeck" };
  return { title: `${invite.coupleA} & ${invite.coupleB} — Invitation` };
}

export default async function InvitationPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const invite = await prisma.invitation.findUnique({
    where: { slug },
    include: { user: { select: { name: true } } },
  });
  if (!invite || !invite.published) notFound();

  const theme = THEMES[invite.template] ?? THEMES.ivory;

  return (
    <div className={`flex min-h-screen items-center justify-center px-4 py-12 ${theme.bg}`}>
      <div className={`w-full max-w-md rounded-2xl border ${theme.ring} bg-white/40 px-8 py-12 text-center backdrop-blur-sm`}>
        <p className={`text-[11px] uppercase tracking-[0.35em] ${theme.accent}`}>
          Together with their families
        </p>

        <h1 className={`mt-8 font-serif text-4xl leading-tight ${theme.ink}`}>
          {invite.coupleA}
        </h1>
        <p className={`my-2 text-xl ${theme.accent}`}>&amp;</p>
        <h1 className={`font-serif text-4xl leading-tight ${theme.ink}`}>{invite.coupleB}</h1>

        {invite.message && (
          <p className={`mt-6 text-sm leading-relaxed ${theme.ink} opacity-75`}>{invite.message}</p>
        )}

        <div className={`mt-8 border-t ${theme.ring} pt-6`}>
          {invite.eventDate && (
            <p className={`text-sm font-medium tracking-wide ${theme.ink}`}>
              {invite.eventDate.toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
          {invite.venue && (
            <p className={`mt-1.5 text-sm ${theme.accent}`}>{invite.venue}</p>
          )}
        </div>

        <RsvpButton slug={invite.slug} initialCount={invite.rsvpCount} />

        <p className={`mt-10 text-[10px] uppercase tracking-[0.3em] ${theme.accent} opacity-60`}>
          {invite.user.name}
        </p>
      </div>
    </div>
  );
}