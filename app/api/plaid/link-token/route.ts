import { NextRequest } from "next/server";
import { CountryCode, Products } from "plaid";
import { plaid } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

// Creates a Plaid Link token. With { itemId } it returns an update-mode token
// for re-authenticating an existing connection (e.g. after ITEM_LOGIN_REQUIRED).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const itemId: string | undefined = body.itemId;

  if (itemId) {
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) return Response.json({ error: "Item not found" }, { status: 404 });
    const resp = await plaid.linkTokenCreate({
      user: { client_user_id: String(item.playerId) },
      client_name: "Finance Aggregator",
      language: "en",
      country_codes: [CountryCode.Us],
      access_token: decrypt(item.accessTokenEnc), // update mode
    });
    return Response.json({ linkToken: resp.data.link_token });
  }

  const playerId = Number(body.playerId);
  if (!playerId) return Response.json({ error: "playerId required" }, { status: 400 });

  const resp = await plaid.linkTokenCreate({
    user: { client_user_id: String(playerId) },
    client_name: "Finance Aggregator",
    // Transactions is supported by depository, credit, and loan accounts, so Link
    // surfaces all of them (Auth alone filters the picker to depository only,
    // hiding credit cards). Liabilities (due dates/APRs) and Auth (ACH numbers,
    // depository-only) are optional so an item without them still links.
    products: [Products.Transactions],
    optional_products: [Products.Liabilities, Products.Auth],
    language: "en",
    country_codes: [CountryCode.Us],
  });
  return Response.json({ linkToken: resp.data.link_token });
}
