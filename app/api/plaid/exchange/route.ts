import { NextRequest } from "next/server";
import { CountryCode } from "plaid";
import { plaid } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { syncItem } from "@/lib/sync";
import { cleanName } from "@/lib/format";

// Exchanges a Plaid public_token for an access_token, persists an encrypted Item
// tagged with the player + entity, then runs an immediate first sync.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const publicToken: string | undefined = body.publicToken;
  const playerId = Number(body.playerId);
  const entity: string = body.entity || "personal";

  if (!publicToken || !playerId) {
    return Response.json({ error: "publicToken and playerId required" }, { status: 400 });
  }

  const exchange = await plaid.itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = exchange.data.access_token;
  const plaidItemId = exchange.data.item_id;

  let institutionId: string | null = null;
  let institutionName: string | null = null;
  try {
    const itemResp = await plaid.itemGet({ access_token: accessToken });
    institutionId = itemResp.data.item.institution_id ?? null;
    if (institutionId) {
      const inst = await plaid.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      });
      institutionName = cleanName(inst.data.institution.name);
    }
  } catch {
    // institution lookup is best-effort
  }

  const item = await prisma.item.create({
    data: {
      playerId,
      entity,
      plaidItemId,
      accessTokenEnc: encrypt(accessToken),
      institutionId,
      institutionName,
    },
  });

  const result = await syncItem(item.id);
  return Response.json({ itemId: item.id, sync: result });
}
