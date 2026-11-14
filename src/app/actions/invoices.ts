"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireModule, nextInvoiceNumber } from "@/lib/access";
import { computeTotals, type ParsedItem } from "@/lib/invoices";

/**
 * Reads `item_description[]`, `item_quantity[]`, `item_rate[]` from the form.
 */
function parseItems(formData: FormData): ParsedItem[] {
  const descriptions = formData.getAll("item_description").map(String);
  const quantities = formData.getAll("item_quantity").map(String);
  const rates = formData.getAll("item_rate").map(String);
  const items: ParsedItem[] = [];
  descriptions.forEach((description, index) => {
    const trimmed = description.trim();
    const quantity = Number(quantities[index] ?? 1);
    const rate = Number(rates[index] ?? 0);
    if (!trimmed) return;
    items.push({
      description: trimmed,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      rate: Number.isFinite(rate) && rate >= 0 ? rate : 0,
    });
  });
  return items;
}

/** Reads the wedding-function schedule from `fn_name[]`, `fn_date[]`, `fn_venue[]`. */
function parseFunctionRows(formData: FormData) {
  const names = formData.getAll("fn_name").map(String);
  const dates = formData.getAll("fn_date").map(String);
  const venues = formData.getAll("fn_venue").map(String);
  const rows: { name: string; date: string; venue: string }[] = [];
  names.forEach((name, index) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    rows.push({
      name: trimmed.slice(0, 40),
      date: String(dates[index] ?? "").trim().slice(0, 40),
      venue: String(venues[index] ?? "").trim().slice(0, 60),
    });
  });
  return rows.slice(0, 8);
}

export async function saveInvoice(formData: FormData) {
  const user = await requireUser();
  const gate = await requireModule(user.id, "invoices", "Invoices");
  if (!gate.ok) return gate;

  const items = parseItems(formData);
  if (items.length === 0) return { ok: false as const, message: "Add at least one line item" };

  const type = formData.get("type") === "QUOTATION" ? "QUOTATION" : "INVOICE";
  const taxRate = Math.max(0, Math.min(28, Number(formData.get("taxRate") || 0)));
  const discount = Math.max(0, Number(formData.get("discount") || 0));
  const clientName = String(formData.get("clientName") || "").trim();
  if (!clientName) return { ok: false as const, message: "Client name is required" };

  const { subtotal, taxAmount, total } = computeTotals(items, taxRate, discount);
  const dueRaw = String(formData.get("dueAt") || "");

  const invoice = await prisma.invoice.create({
    data: {
      userId: user.id,
      eventId: String(formData.get("eventId") || "") || null,
      number: await nextInvoiceNumber(user.id, type),
      type,
      status: "DRAFT",
      dueAt: dueRaw ? new Date(dueRaw) : null,
      clientName,
      clientEmail: String(formData.get("clientEmail") || "").trim() || null,
      clientPhone: String(formData.get("clientPhone") || "").trim() || null,
      clientAddress: String(formData.get("clientAddress") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      functions: JSON.stringify(parseFunctionRows(formData)),
      taxRate,
      discount,
      subtotal,
      taxAmount,
      total,
      items: {
        create: items.map((item, index) => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: Math.round(item.quantity * item.rate * 100) / 100,
          position: index,
        })),
      },
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
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status } });
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/invoice/${invoiceId}`);
  return { ok: true as const };
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

  const taxRate = 0;
  const discount = Math.max(0, Number(formData.get("discount") || invoice.discount));
  const { subtotal, taxAmount, total } = computeTotals(items, taxRate, discount);

  await prisma.$transaction([
    prisma.invoiceItem.deleteMany({ where: { invoiceId } }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        taxRate,
        discount,
        subtotal,
        taxAmount,
        total,
        clientName: String(formData.get("clientName") || invoice.clientName).trim(),
        clientPhone: String(formData.get("clientPhone") || "").trim() || null,
        clientEmail: String(formData.get("clientEmail") || "").trim() || null,
        clientAddress: String(formData.get("clientAddress") || "").trim() || null,
        notes: String(formData.get("notes") || "").trim() || null,
        functions: JSON.stringify(parseFunctionRows(formData)),
        items: {
          create: items.map((item, index) => ({
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: Math.round(item.quantity * item.rate * 100) / 100,
            position: index,
          })),
        },
      },
    }),
  ]);

  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  revalidatePath(`/invoice/${invoiceId}`);
  return { ok: true as const };
}