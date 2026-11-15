"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireModule, nextInvoiceNumber } from "@/lib/access";
import {
  PAYMENT_MODES,
  computeTotals,
  newShareToken,
  round2,
  totalPaid,
  type ParsedItem,
} from "@/lib/invoices";

type ParsedLine = ParsedItem & { group: string };

const DEFAULT_GROUP = "Deliverables";

/**
 * Reads `item_description[]`, `item_quantity[]`, `item_rate[]`, `item_group[]`.
 * A blank description drops the row, which is how the editor's empty starter
 * line disappears without the user deleting it.
 */
function parseItems(formData: FormData): ParsedLine[] {
  const descriptions = formData.getAll("item_description").map(String);
  const quantities = formData.getAll("item_quantity").map(String);
  const rates = formData.getAll("item_rate").map(String);
  const groups = formData.getAll("item_group").map(String);

  const items: ParsedLine[] = [];
  descriptions.forEach((description, index) => {
    const trimmed = description.trim();
    if (!trimmed) return;
    const quantity = Number(quantities[index] ?? 1);
    const rate = Number(rates[index] ?? 0);
    items.push({
      description: trimmed.slice(0, 200),
      quantity: Number.isFinite(quantity) && quantity > 0 ? round2(quantity) : 1,
      rate: Number.isFinite(rate) && rate >= 0 ? round2(rate) : 0,
      group: String(groups[index] ?? "").trim().slice(0, 40) || DEFAULT_GROUP,
    });
  });
  return items;
}

/** Reads the wedding-function schedule from `fn_*[]` fields. */
function parseFunctionRows(formData: FormData) {
  const names = formData.getAll("fn_name").map(String);
  const dates = formData.getAll("fn_date").map(String);
  const venues = formData.getAll("fn_venue").map(String);
  const descs = formData.getAll("fn_desc").map(String);

  const rows: { name: string; date: string; venue: string; desc: string }[] = [];
  names.forEach((name, index) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    rows.push({
      name: trimmed.slice(0, 40),
      date: String(dates[index] ?? "").trim().slice(0, 40),
      venue: String(venues[index] ?? "").trim().slice(0, 60),
      desc: String(descs[index] ?? "").trim().slice(0, 120),
    });
  });
  return rows.slice(0, 8);
}

/** Newline-separated terms text from a textarea, one line per entry. */
function parseTermsInput(formData: FormData, field: string): string[] {
  return String(formData.get(field) || "")
    .split(/\r?\n/)
    .map((line) => line.trim().slice(0, 200))
    .filter((line) => line.length > 0)
    .slice(0, 12);
}

/** Reads `pay_amount[]`, `pay_date[]`, `pay_mode[]`, `pay_note[]`. */
function parsePayments(formData: FormData) {
  const amounts = formData.getAll("pay_amount").map(String);
  const dates = formData.getAll("pay_date").map(String);
  const modes = formData.getAll("pay_mode").map(String);
  const notes = formData.getAll("pay_note").map(String);

  const rows: { amount: number; paidAt: Date; mode: string; note: string | null; position: number }[] =
    [];
  amounts.forEach((raw, index) => {
    const amount = round2(Number(raw));
    if (!Number.isFinite(amount) || amount <= 0) return;
    const rawDate = String(dates[index] ?? "").trim();
    const parsed = rawDate ? new Date(rawDate) : new Date();
    const mode = String(modes[index] ?? "").toUpperCase();
    rows.push({
      amount,
      paidAt: Number.isNaN(parsed.getTime()) ? new Date() : parsed,
      mode: (PAYMENT_MODES as readonly string[]).includes(mode) ? mode : "UPI",
      note: String(notes[index] ?? "").trim().slice(0, 120) || null,
      position: rows.length,
    });
  });
  return rows;
}

export async function saveInvoice(formData: FormData) {
  const user = await requireUser();
  const gate = await requireModule(user.id, "invoices", "Invoices");
  if (!gate.ok) return gate;

  const items = parseItems(formData);
  if (items.length === 0) return { ok: false as const, message: "Add at least one line item" };

  const type = formData.get("type") === "QUOTATION" ? "QUOTATION" : "INVOICE";
  const clientName = String(formData.get("clientName") || "").trim();
  if (!clientName) return { ok: false as const, message: "Client name is required" };

  const budgetMode = formData.get("budgetMode") === "on";
  const budgetAmount = Math.max(0, round2(Number(formData.get("budgetAmount") || 0)));
  const discount = Math.max(0, round2(Number(formData.get("discount") || 0)));
  const extra = Math.max(0, round2(Number(formData.get("extra") || 0)));
  const { subtotal, total } = computeTotals({ items, discount, extra, budgetAmount, budgetMode });

  const dueRaw = String(formData.get("dueAt") || "");
  const payments = parsePayments(formData);

  const invoice = await prisma.invoice.create({
    data: {
      userId: user.id,
      eventId: String(formData.get("eventId") || "") || null,
      number: await nextInvoiceNumber(user.id),
      type,
      status: "DRAFT",
      dueAt: dueRaw ? new Date(dueRaw) : null,
      clientName,
      clientEmail: String(formData.get("clientEmail") || "").trim() || null,
      clientPhone: String(formData.get("clientPhone") || "").trim() || null,
      clientAddress: String(formData.get("clientAddress") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      functions: JSON.stringify(parseFunctionRows(formData)),
      terms: JSON.stringify(parseTermsInput(formData, "terms")),
      budgetMode,
      budgetAmount,
      discount,
      extra,
      subtotal,
      total,
      advance: totalPaid(payments),
      items: {
        create: items.map((item, index) => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: round2(item.quantity * item.rate),
          group: item.group,
          position: index,
        })),
      },
      payments: { create: payments },
    },
  });

  revalidatePath("/dashboard/invoices");
  return { ok: true as const, id: invoice.id, number: invoice.number };
}

export async function setInvoiceStatus(invoiceId: string, status: string) {
  const user = await requireUser();
  const allowed = ["DRAFT", "SENT", "PAID", "CANCELLED"];
  if (!allowed.includes(status)) return { ok: false as const, message: "Unknown status" };
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, userId: user.id } });
  if (!invoice) return { ok: false as const, message: "Invoice not found" };

  // The public link is minted on the first send, never for a draft.
  const token = invoice.publicToken ?? (status === "SENT" || status === "PAID" ? newShareToken() : null);
  const nextToken = invoice.publicToken ? null : token;

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status, ...(nextToken ? { publicToken: nextToken } : {}) },
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/invoice/${invoiceId}`);
  return { ok: true as const, token: invoice.publicToken ?? nextToken ?? null };
}

export async function deleteInvoice(invoiceId: string) {
  const user = await requireUser();
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, userId: user.id } });
  if (!invoice) return { ok: false as const, message: "Invoice not found" };
  await prisma.invoice.delete({ where: { id: invoiceId } });
  revalidatePath("/dashboard/invoices");
  return { ok: true as const };
}

export async function updateInvoiceItems(invoiceId: string, formData: FormData) {
  const user = await requireUser();
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, userId: user.id } });
  if (!invoice) return { ok: false as const, message: "Invoice not found" };

  const items = parseItems(formData);
  if (items.length === 0) return { ok: false as const, message: "Add at least one line item" };

  const budgetMode = formData.get("budgetMode") === "on";
  const budgetAmount = Math.max(0, round2(Number(formData.get("budgetAmount") || 0)));
  const discount = Math.max(0, round2(Number(formData.get("discount") || invoice.discount)));
  const extra = Math.max(0, round2(Number(formData.get("extra") || invoice.extra)));
  const { subtotal, total } = computeTotals({ items, discount, extra, budgetAmount, budgetMode });

  const payments = parsePayments(formData);

  await prisma.$transaction([
    prisma.invoiceItem.deleteMany({ where: { invoiceId } }),
    prisma.invoicePayment.deleteMany({ where: { invoiceId } }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        budgetMode,
        budgetAmount,
        discount,
        extra,
        subtotal,
        total,
        advance: totalPaid(payments),
        clientName: String(formData.get("clientName") || invoice.clientName).trim(),
        clientPhone: String(formData.get("clientPhone") || "").trim() || null,
        clientEmail: String(formData.get("clientEmail") || "").trim() || null,
        clientAddress: String(formData.get("clientAddress") || "").trim() || null,
        notes: String(formData.get("notes") || "").trim() || null,
        functions: JSON.stringify(parseFunctionRows(formData)),
        terms: JSON.stringify(parseTermsInput(formData, "terms")),
        items: {
          create: items.map((item, index) => ({
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: round2(item.quantity * item.rate),
            group: item.group,
            position: index,
          })),
        },
        payments: { create: payments },
      },
    }),
  ]);

  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath(`/invoice/${invoiceId}`);
  return { ok: true as const };
}
