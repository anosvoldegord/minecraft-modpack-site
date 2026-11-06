import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { amount, description, packId, userId } = await req.json();
    
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;

    if (!shopId || !secretKey) {
      return NextResponse.json({ error: 'Ошибка конфигурации сервера' }, { status: 500 });
    }

    const idempotenceKey = crypto.randomUUID();

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotenceKey,
        'Authorization': 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64'),
      },
      body: JSON.stringify({
        amount: { value: amount.toFixed(2), currency: 'RUB' },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: 'https://minecraft-modpack-site.layero.app/?success=true',
        },
        description: description,
        metadata: { packId, userId }
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.description || 'Ошибка ЮKassa' }, { status: response.status });
    }

    return NextResponse.json({ confirmation_url: data.confirmation.confirmation_url });

  } catch (error) {
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}