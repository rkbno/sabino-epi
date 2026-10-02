import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { CATALOG } from "./_catalog.mjs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20)
    return json({ error: "Carrinho inválido" }, 400);

  // Preço e título vêm do catálogo do servidor, nunca do navegador.
  const items = [];
  for (const it of body.items) {
    const p = CATALOG[it.id];
    const qty = Number(it.qty);
    if (!p || !Number.isInteger(qty) || qty < 1 || qty > 50)
      return json({ error: "Item inválido" }, 400);
    items.push({ id: it.id, title: p.title, quantity: qty, unit_price: p.price, currency_id: "BRL" });
  }
  const total = Math.round(items.reduce((s, i) => s + i.unit_price * i.quantity, 0) * 100) / 100;

  const orderId = randomUUID();
  const site = process.env.SITE_URL || process.env.URL;

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": orderId,
    },
    body: JSON.stringify({
      items,
      external_reference: orderId,
      back_urls: {
        success: `${site}/?status=sucesso`,
        failure: `${site}/?status=falha`,
        pending: `${site}/?status=pendente`,
      },
      auto_return: "approved",
      notification_url: `${site}/.netlify/functions/mp-webhook`,
      statement_descriptor: "SABINO EPI",
    }),
  });

  if (!res.ok) {
    console.error("Mercado Pago:", res.status, await res.text());
    return json({ error: "Não foi possível iniciar o pagamento" }, 502);
  }
  const pref = await res.json();

  await getStore("orders").setJSON(orderId, {
    items, total, status: "pendente", createdAt: new Date().toISOString(),
  });

  return json({ url: pref.init_point });
};
