// YandexPay integration service
// Docs: https://pay.yandex.ru/docs/

const YANDEX_PAY_API_URL = "https://pay.yandex.ru/api/v1";

interface CreatePaymentParams {
  amount: number;
  description: string;
  returnUrl: string;
  metadata?: Record<string, string>;
}

export async function createPayment({ amount, description, returnUrl, metadata }: CreatePaymentParams) {
  const response = await fetch(`${YANDEX_PAY_API_URL}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.YANDEX_PAY_API_KEY}`,
    },
    body: JSON.stringify({
      merchant_id: process.env.YANDEX_PAY_MERCHANT_ID,
      amount: { value: amount.toFixed(2), currency: "RUB" },
      description,
      return_url: returnUrl,
      metadata,
    }),
  });

  if (!response.ok) {
    throw new Error(`YandexPay error: ${response.statusText}`);
  }

  return response.json();
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  // TODO: Implement signature verification when YandexPay provides the algorithm
  // For now, basic check that signature exists
  return !!signature;
}
