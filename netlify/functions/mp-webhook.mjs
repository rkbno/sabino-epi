import { createHmac, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

const STATUS = { approved: "pago", pending: "pendente", in_process: "pendente",
  rejected: "recusado", cancelled: "cancelado", refunded: "reembolsado", charged_back: "contestado" };

export default async (req) => {
  const url = new URL(req.url);
  const dataId = (url.searchParams.get("data.id") || "").toLowerCase();
  const reqId = req.headers.get("x-request-id") || "";
  const sig = Object.fromEntries(
    (req.headers.get("x-signature") || "").split(",").map((p) => p.trim().split("="))
  );

  // 1) Valida a assinatura: só o Mercado Pago consegue gerar este HMAC.
  const manifest = `id:${dataId};request-id:${reqId};ts:${sig.ts};`;
  const expected = createHmac("sha256", process.env.MP_WEBHOOK_SECRET).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig.v1 || "");
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return new Response("assinatura inválida", { status: 401 });

  const type = url.searchParams.get("type") || url.searchParams.get("topic");
  if (type !== "payment" || !dataId) return new Response("ok", { status: 200 });

  // 2) Não confia no corpo da notificação: consulta o pagamento direto na API.
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  });
  if (!res.ok) return new Response("erro ao consultar", { status: 502 }); // MP tenta de novo
  const pay = await res.json();

  // 3) Confere pedido e valor antes de marcar como pago.
  const store = getStore("orders");
  const order = await store.get(pay.external_reference, { type: "json" });
  if (!order) return new Response("pedido não encontrado", { status: 200 });

  const status = STATUS[pay.status] || "pendente";
  if (status === "pago" && Number(pay.transaction_amount) !== order.total) {
    console.error("Valor divergente", pay.external_reference);
    order.status = "divergente";
  } else {
    order.status = status;
  }
  order.paymentId = pay.id;
  order.updatedAt = new Date().toISOString();
  await store.setJSON(pay.external_reference, order);

  return new Response("ok", { status: 200 });
};
