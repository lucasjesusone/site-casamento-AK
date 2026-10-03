import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Pool, type QueryResultRow } from 'pg';

dotenv.config();

interface Gift {
  id: string;
  title: string;
  description: string;
  amount: number;
  imageUrl: string;
  createdAt: string;
}

interface GiftRecord extends QueryResultRow {
  id: string;
  title: string;
  description: string;
  amount: number | string;
  image_url: string;
  created_at: string;
}

interface CheckoutItemRequest {
  giftId: string;
  quantity: number;
}

interface StoredOrder extends QueryResultRow {
  id: string;
  total: number;
  status: string;
}

function mapGift(row: GiftRecord): Gift {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    amount: Number(row.amount),
    imageUrl: row.image_url,
    createdAt: row.created_at
  };
}

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL não foi configurada.');
}

const database = new Pool({
  connectionString: databaseUrl,
  max: 5
});
const allowedOrigins = (process.env['CORS_ORIGINS'] || 'http://localhost:4200,http://127.0.0.1:4200')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
database.on('error', (error: Error) => {
  app.log.error(error, 'Unexpected PostgreSQL pool error');
});

async function readGifts(): Promise<Gift[]> {
  const result = await database.query<GiftRecord>(
    'select id, title, description, amount, image_url, created_at from gifts order by created_at asc'
  );
  return result.rows.map(mapGift);
}

async function getStoredOrder(id: string): Promise<StoredOrder | undefined> {
  const result = await database.query<StoredOrder>(
    'select id, total::float8 as total, status from orders where id = $1',
    [id]
  );
  return result.rows[0];
}

function isValidMercadoPagoSignature(signatureHeader: string | undefined, requestId: string | undefined, dataId: string, secret: string): boolean {
  if (!signatureHeader || !requestId) {
    return false;
  }

  const parts = Object.fromEntries(signatureHeader.split(',').map((part) => {
    const [key, ...value] = part.trim().split('=');
    return [key, value.join('=')];
  }));
  const timestamp = parts['ts'];
  const receivedSignature = parts['v1'];
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const expectedSignature = createHmac('sha256', secret).update(manifest).digest();
  const received = Buffer.from(receivedSignature, 'hex');
  return received.length === expectedSignature.length && timingSafeEqual(received, expectedSignature);
}

const adminSessionSecret = process.env['ADMIN_SESSION_SECRET'] || randomBytes(32).toString('hex');

function isAdminAuthorized(authorization?: string): boolean {
  const password = process.env['ADMIN_PASSWORD'];
  const token = authorization?.replace(/^Bearer\s+/i, '');

  if (!password || !token) {
    return false;
  }

  const [expiresAt, signature] = token.split('.');
  if (!expiresAt || !signature || Number(expiresAt) <= Date.now()) {
    return false;
  }

  const expected = createHmac('sha256', adminSessionSecret).update(`${password}.${expiresAt}`).digest();
  const received = Buffer.from(signature, 'base64url');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function requireAdmin(authorization: string | undefined, reply: { code: (statusCode: number) => { send: (body: unknown) => unknown } }): boolean {
  if (isAdminAuthorized(authorization)) {
    return true;
  }

  reply.code(401).send({ error: 'Acesso não autorizado.' });
  return false;
}

const app = Fastify({
  logger: true,
  trustProxy: true
});

const rsvpAttempts = new Map<string, { count: number; resetAt: number }>();

function isRsvpRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rsvpAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    rsvpAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    if (rsvpAttempts.size > 5000) {
      for (const [key, value] of rsvpAttempts) {
        if (value.resetAt <= now) {
          rsvpAttempts.delete(key);
        }
      }
    }
    return false;
  }
  entry.count += 1;
  return entry.count > 30;
}

type GuestCategory = 'adult' | 'child_half' | 'child_free';
type GuestStatus = 'pending' | 'confirmed' | 'declined';
const guestCategories: GuestCategory[] = ['adult', 'child_half', 'child_free'];

interface GuestRow extends QueryResultRow {
  id: string;
  family_id: string;
  name: string;
  category: GuestCategory;
  status: GuestStatus;
  responded_at: string | null;
}

interface FamilyRow extends QueryResultRow {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

function mapGuest(row: GuestRow) {
  return { id: row.id, name: row.name, category: row.category, status: row.status, respondedAt: row.responded_at };
}

function generateFamilyCode(): string {
  return randomBytes(9).toString('base64url');
}

async function readFamilies() {
  const families = await database.query<FamilyRow>('select id, name, code, created_at from families order by name asc');
  const guests = await database.query<GuestRow>(
    'select id, family_id, name, category, status, responded_at from guests order by family_id, position asc, name asc'
  );
  return families.rows.map((family) => ({
    id: family.id,
    name: family.name,
    code: family.code,
    createdAt: family.created_at,
    guests: guests.rows.filter((guest) => guest.family_id === family.id).map(mapGuest)
  }));
}

async function start() {
  const sourceDirectory = dirname(fileURLToPath(import.meta.url));
  const schema = readFileSync(resolve(sourceDirectory, '../sql/schema.sql'), 'utf8');
  await database.query(schema);

  await app.register(cors, {
    origin: (origin, callback) => {
      callback(null, !origin || allowedOrigins.includes(origin));
    }
  });

  app.get('/api/health', async () => {
    await database.query('select 1');
    return {
      status: 'UP',
      message: 'Backend do casamento funcionando ❤️❤️'
    };
  });

  app.post('/api/checkout', async (request, reply) => {
    const accessToken = process.env['MERCADOPAGO_ACCESS_TOKEN'];
    const webhookSecret = process.env['MERCADOPAGO_WEBHOOK_SECRET'];
    const notificationUrl = process.env['MERCADOPAGO_WEBHOOK_URL'];
    if (!accessToken || !webhookSecret || !notificationUrl) {
      return reply.code(503).send({ error: 'Configure as credenciais e o webhook do Mercado Pago antes de habilitar pagamentos.' });
    }

    let validatedNotificationUrl: URL;
    try {
      validatedNotificationUrl = new URL(notificationUrl);
    } catch {
      return reply.code(503).send({ error: 'MERCADOPAGO_WEBHOOK_URL precisa ser uma URL HTTPS pública terminando em /api/payments/mercadopago/webhook.' });
    }

    const webhookHost = validatedNotificationUrl.hostname.toLowerCase();
    const isLocalWebhook = ['localhost', '127.0.0.1', '::1'].includes(webhookHost) || webhookHost.endsWith('.localhost') || webhookHost.endsWith('.local');
    if (validatedNotificationUrl.protocol !== 'https:' || isLocalWebhook || validatedNotificationUrl.pathname.replace(/\/$/, '') !== '/api/payments/mercadopago/webhook') {
      return reply.code(503).send({ error: 'MERCADOPAGO_WEBHOOK_URL precisa ser HTTPS público e usar o caminho /api/payments/mercadopago/webhook.' });
    }

    const body = (request.body || {}) as { items?: CheckoutItemRequest[] };
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 30) {
      return reply.code(400).send({ error: 'O carrinho não contém itens válidos.' });
    }

    const requestedItems = new Map<string, number>();
    for (const item of body.items) {
      if (typeof item.giftId !== 'string' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
        return reply.code(400).send({ error: 'Um dos itens do carrinho é inválido.' });
      }
      const combinedQuantity = (requestedItems.get(item.giftId) || 0) + item.quantity;
      if (combinedQuantity > 20) {
        return reply.code(400).send({ error: 'A quantidade máxima por presente é 20.' });
      }
      requestedItems.set(item.giftId, combinedQuantity);
    }

    const catalog = await readGifts();
    const giftsById = new Map(catalog.map((gift) => [gift.id, gift]));
    const items = [];
    for (const [giftId, quantity] of requestedItems) {
      const gift = giftsById.get(giftId);
      if (!gift) {
        return reply.code(400).send({ error: 'Um presente do carrinho não está mais disponível.' });
      }
      items.push({ gift, quantity });
    }

    const frontendUrl = (process.env['FRONTEND_PUBLIC_URL'] || 'http://localhost:4200').replace(/\/$/, '');
    const useSandbox = process.env['MERCADOPAGO_SANDBOX'] !== 'false';
    const frontendHost = new URL(frontendUrl).hostname;
    const hasPublicReturnUrl = frontendUrl.startsWith('https://') && !['localhost', '127.0.0.1', '::1'].includes(frontendHost);

    const total = Math.round(items.reduce((sum, item) => sum + item.gift.amount * item.quantity, 0) * 100) / 100;
    const orderId = crypto.randomUUID();
    const now = new Date().toISOString();
    const client = await database.connect();
    try {
      await client.query('begin');
      await client.query(
        'insert into orders (id, status, total, currency, created_at, updated_at) values ($1, $2, $3, $4, $5, $6)',
        [orderId, 'checkout_created', total, 'BRL', now, now]
      );
      for (const item of items) {
        await client.query(
          'insert into order_items (order_id, gift_id, title, quantity, unit_amount) values ($1, $2, $3, $4, $5)',
          [orderId, item.gift.id, item.gift.title, item.quantity, item.gift.amount]
        );
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    const preferencePayload = {
      items: items.map(({ gift, quantity }) => ({
        id: gift.id,
        title: gift.title,
        quantity,
        currency_id: 'BRL',
        unit_price: gift.amount
      })),
      external_reference: orderId,
      metadata: { order_id: orderId },
      ...(hasPublicReturnUrl ? {
        back_urls: {
          success: `${frontendUrl}/?payment=success&order_id=${orderId}`,
          pending: `${frontendUrl}/?payment=pending&order_id=${orderId}`,
          failure: `${frontendUrl}/?payment=failure&order_id=${orderId}`
        },
        auto_return: 'approved'
      } : {}),
      payment_methods: {
        installments: 12,
        default_installments: 1,
        excluded_payment_types: [
          { id: 'ticket' },
          { id: 'atm' },
          { id: 'debit_card' }
        ]
      },
      notification_url: validatedNotificationUrl.toString()
    };

    try {
      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': orderId
        },
        body: JSON.stringify(preferencePayload)
      });
      const responseBody = await response.text();
      let preference: {
        id?: string;
        init_point?: string;
        sandbox_init_point?: string;
        message?: string;
        error?: string;
        cause?: Array<{ code?: string | number; description?: string }>;
      };
      try {
        preference = JSON.parse(responseBody) as typeof preference;
      } catch {
        preference = { message: 'Resposta inválida do Mercado Pago.' };
      }
      const checkoutUrl = useSandbox ? preference.sandbox_init_point : preference.init_point;
      if (!response.ok || !preference.id || !checkoutUrl) {
        request.log.error({
          statusCode: response.status,
          error: preference.error,
          message: preference.message,
          causes: preference.cause
        }, 'Mercado Pago preference creation failed');
        await database.query(
          'update orders set status = $1, updated_at = $2 where id = $3',
          ['checkout_error', new Date().toISOString(), orderId]
        );
        return reply.code(502).send({ error: 'O Mercado Pago recusou a preferência. Consulte o log do backend para ver o código e a causa.' });
      }

      await database.query(
        'update orders set preference_id = $1, status = $2, updated_at = $3 where id = $4',
        [preference.id, 'pending', new Date().toISOString(), orderId]
      );
      return { orderId, checkoutUrl };
    } catch (error) {
      request.log.error(error, 'Mercado Pago request failed');
      await database.query(
        'update orders set status = $1, updated_at = $2 where id = $3',
        ['checkout_error', new Date().toISOString(), orderId]
      );
      return reply.code(502).send({ error: 'Não foi possível conectar ao Mercado Pago. Tente novamente.' });
    }
  });

  app.get('/api/orders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await getStoredOrder(id);
    if (!order) {
      return reply.code(404).send({ error: 'Pedido não encontrado.' });
    }

    return { id: order.id, status: order.status, total: order.total };
  });

  app.post('/api/payments/mercadopago/webhook', async (request, reply) => {
    const webhookSecret = process.env['MERCADOPAGO_WEBHOOK_SECRET'];
    const accessToken = process.env['MERCADOPAGO_ACCESS_TOKEN'];
    if (!webhookSecret || !accessToken) {
      return reply.code(503).send({ error: 'Webhook de pagamento não configurado.' });
    }

    const query = request.query as { type?: string; topic?: string; 'data.id'?: string };
    const body = request.body as { type?: string; action?: string; data?: { id?: string } } | undefined;
    const dataId = query['data.id'] || body?.data?.id;
    const eventType = query.type || query.topic || body?.type || body?.action?.split('.')[0];
    if (eventType && eventType !== 'payment') {
      return reply.code(200).send({ received: true });
    }
    if (!dataId) {
      return reply.code(400).send({ error: 'Notificação de pagamento sem ID.' });
    }

    const signatureHeader = request.headers['x-signature'];
    const requestIdHeader = request.headers['x-request-id'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;
    if (!isValidMercadoPagoSignature(signature, requestId, dataId, webhookSecret)) {
      return reply.code(401).send({ error: 'Assinatura do webhook inválida.' });
    }

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!paymentResponse.ok) {
      request.log.error({ statusCode: paymentResponse.status }, 'Mercado Pago payment lookup failed');
      return reply.code(502).send({ error: 'Não foi possível consultar o pagamento.' });
    }

    const payment = await paymentResponse.json() as {
      id?: number;
      status?: string;
      external_reference?: string;
      transaction_amount?: number;
      currency_id?: string;
      payment_method_id?: string;
    };
    if (!payment.external_reference || !payment.id || !payment.status) {
      return reply.code(400).send({ error: 'Dados do pagamento incompletos.' });
    }

    const order = await getStoredOrder(payment.external_reference);
    if (!order) {
      return reply.code(404).send({ error: 'Pedido relacionado ao pagamento não encontrado.' });
    }
    if (payment.status === 'approved' && (payment.currency_id !== 'BRL' || Math.abs(Number(payment.transaction_amount) - order.total) > 0.01)) {
      request.log.error({ orderId: order.id, paymentId: payment.id }, 'Payment total or currency mismatch');
      return reply.code(400).send({ error: 'Valor ou moeda do pagamento não corresponde ao pedido.' });
    }

    await database.query(
      'update orders set payment_id = $1, payment_method = $2, status = $3, updated_at = $4 where id = $5',
      [
        String(payment.id),
        payment.payment_method_id || null,
        payment.status,
        new Date().toISOString(),
        order.id
      ]
    );
    return reply.code(200).send({ received: true });
  });

  app.get('/api/gallery', async (request, reply) => {
    const cloudName = process.env['CLOUDINARY_CLOUD_NAME'];
    const apiKey = process.env['CLOUDINARY_API_KEY'];
    const apiSecret = process.env['CLOUDINARY_API_SECRET'];
    const folder = process.env['CLOUDINARY_GALLERY_FOLDER'] || 'wedding';

    if (!cloudName || !apiKey || !apiSecret) {
      return reply.code(503).send({ error: 'Galeria do Cloudinary não configurada.' });
    }

    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/search`;
    const gallery = [];
    let nextCursor: string | undefined;

    do {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expression: `folder="${folder.replaceAll('"', '')}" AND resource_type:image`,
          sort_by: [{ public_id: 'asc' }],
          max_results: 100,
          ...(nextCursor ? { next_cursor: nextCursor } : {})
        })
      });

      if (!response.ok) {
        request.log.error({ statusCode: response.status }, 'Cloudinary gallery request failed');
        return reply.code(502).send({ error: 'Não foi possível carregar a galeria.' });
      }

      const result = (await response.json()) as {
        resources?: Array<{
          public_id: string;
          secure_url: string;
          filename?: string;
          context?: { custom?: { caption?: string; title?: string } };
        }>;
        next_cursor?: string;
      };

      for (const image of result.resources || []) {
        const filename = image.filename || image.public_id.split('/').pop() || image.public_id;
        gallery.push({
          title: image.context?.custom?.caption || image.context?.custom?.title || filename,
          accent: ['rose', 'gold', 'sage'][gallery.length % 3],
          imageUrl: image.secure_url
        });
      }

      nextCursor = result.next_cursor;
    } while (nextCursor);

    return gallery;
  });

  app.get('/api/admin/images', async (request, reply) => {
    if (!requireAdmin(request.headers.authorization, reply)) {
      return;
    }

    const cloudName = process.env['CLOUDINARY_CLOUD_NAME'];
    const apiKey = process.env['CLOUDINARY_API_KEY'];
    const apiSecret = process.env['CLOUDINARY_API_SECRET'];
    const folder = process.env['CLOUDINARY_GIFTS_FOLDER'] || 'Gifts';

    if (!cloudName || !apiKey || !apiSecret) {
      return reply.code(503).send({ error: 'Cloudinary não configurado.' });
    }

    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/search`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expression: `folder="${folder.replaceAll('"', '')}" AND resource_type:image`,
        sort_by: [{ public_id: 'asc' }],
        max_results: 100
      })
    });

    if (!response.ok) {
      return reply.code(502).send({ error: 'Não foi possível listar as imagens.' });
    }

    const result = (await response.json()) as { resources?: Array<{ public_id: string; secure_url: string }> };
    return (result.resources || []).map((image) => ({ id: image.public_id, imageUrl: image.secure_url }));
  });

  app.post('/api/admin/login', async (request, reply) => {
    const password = process.env['ADMIN_PASSWORD'];
    const body = request.body as { password?: string };

    if (!password) {
      return reply.code(503).send({ error: 'Acesso administrativo não configurado.' });
    }

    const submitted = createHash('sha256').update(body.password || '').digest();
    const expected = createHash('sha256').update(password).digest();
    if (!timingSafeEqual(submitted, expected)) {
      return reply.code(401).send({ error: 'Senha incorreta.' });
    }

    const expiresAt = String(Date.now() + 8 * 60 * 60 * 1000);
    const signature = createHmac('sha256', adminSessionSecret).update(`${password}.${expiresAt}`).digest('base64url');
    return { token: `${expiresAt}.${signature}` };
  });

  app.get('/api/gifts', async () => readGifts());

  app.get('/api/admin/gifts', async (request, reply) => {
    if (!requireAdmin(request.headers.authorization, reply)) {
      return;
    }

    return readGifts();
  });

  app.post('/api/admin/gifts', async (request, reply) => {
    if (!requireAdmin(request.headers.authorization, reply)) {
      return;
    }

    const body = request.body as Partial<Gift>;
    if (!body.title?.trim() || !Number.isFinite(body.amount) || (body.amount ?? 0) <= 0 || !body.imageUrl?.trim()) {
      return reply.code(400).send({ error: 'Preencha título, valor e imagem.' });
    }

    const gift: Gift = {
      id: body.id || crypto.randomUUID(),
      title: body.title.trim(),
      description: body.description?.trim() || '',
      amount: Math.round((body.amount as number) * 100) / 100,
      imageUrl: body.imageUrl.trim(),
      createdAt: body.createdAt || new Date().toISOString()
    };

    await database.query(`
      insert into gifts (id, title, description, amount, image_url, created_at)
      values ($1, $2, $3, $4, $5, $6)
      on conflict(id) do update set
        title = excluded.title,
        description = excluded.description,
        amount = excluded.amount,
        image_url = excluded.image_url
    `, [gift.id, gift.title, gift.description, gift.amount, gift.imageUrl, gift.createdAt]);
    return reply.code(201).send(gift);
  });

  app.delete('/api/admin/gifts/:id', async (request, reply) => {
    if (!requireAdmin(request.headers.authorization, reply)) {
      return;
    }

    const { id } = request.params as { id: string };
    await database.query('delete from gifts where id = $1', [id]);
    return reply.code(204).send();
  });

  app.get('/api/rsvp/:code', async (request, reply) => {
    if (isRsvpRateLimited(request.ip)) {
      return reply.code(429).send({ error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' });
    }

    const { code } = request.params as { code: string };
    const family = (await database.query<FamilyRow>('select id, name, code, created_at from families where code = $1', [code])).rows[0];
    if (!family) {
      return reply.code(404).send({ error: 'Convite não encontrado.' });
    }

    const guests = await database.query<GuestRow>(
      'select id, family_id, name, category, status, responded_at from guests where family_id = $1 order by position asc, name asc',
      [family.id]
    );
    return { familyName: family.name, guests: guests.rows.map(mapGuest) };
  });

  app.post('/api/rsvp/:code', async (request, reply) => {
    if (isRsvpRateLimited(request.ip)) {
      return reply.code(429).send({ error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' });
    }

    const { code } = request.params as { code: string };
    const body = (request.body || {}) as { responses?: Array<{ guestId?: string; status?: string }> };
    if (!Array.isArray(body.responses) || body.responses.length === 0 || body.responses.length > 50) {
      return reply.code(400).send({ error: 'Envie a resposta de cada integrante.' });
    }
    if (body.responses.some((item) => typeof item.guestId !== 'string' || !['confirmed', 'declined'].includes(item.status || ''))) {
      return reply.code(400).send({ error: 'Resposta inválida.' });
    }

    const family = (await database.query<FamilyRow>('select id, name, code, created_at from families where code = $1', [code])).rows[0];
    if (!family) {
      return reply.code(404).send({ error: 'Convite não encontrado.' });
    }

    const now = new Date().toISOString();
    for (const item of body.responses) {
      await database.query(
        'update guests set status = $1, responded_at = $2 where id = $3 and family_id = $4',
        [item.status, now, item.guestId, family.id]
      );
    }

    const guests = await database.query<GuestRow>(
      'select id, family_id, name, category, status, responded_at from guests where family_id = $1 order by position asc, name asc',
      [family.id]
    );
    return { familyName: family.name, guests: guests.rows.map(mapGuest) };
  });

  app.get('/api/admin/families', async (request, reply) => {
    if (!requireAdmin(request.headers.authorization, reply)) {
      return;
    }

    return readFamilies();
  });

  app.post('/api/admin/families', async (request, reply) => {
    if (!requireAdmin(request.headers.authorization, reply)) {
      return;
    }

    const body = (request.body || {}) as {
      id?: string;
      name?: string;
      guests?: Array<{ id?: string; name?: string; category?: string }>;
    };
    const name = body.name?.trim();
    const guests = Array.isArray(body.guests) ? body.guests : [];
    if (!name || name.length > 90 || guests.length === 0 || guests.length > 30) {
      return reply.code(400).send({ error: 'Informe o nome da família e ao menos um integrante.' });
    }
    if (guests.some((guest) => !guest.name?.trim() || guest.name.length > 90 || !guestCategories.includes(guest.category as GuestCategory))) {
      return reply.code(400).send({ error: 'Cada integrante precisa de nome e categoria válidos.' });
    }

    const familyId = body.id || crypto.randomUUID();
    const client = await database.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into families (id, name, code, created_at) values ($1, $2, $3, $4)
         on conflict(id) do update set name = excluded.name`,
        [familyId, name, generateFamilyCode(), new Date().toISOString()]
      );

      const keptIds: string[] = [];
      for (const [position, guest] of guests.entries()) {
        const guestId = guest.id || crypto.randomUUID();
        keptIds.push(guestId);
        await client.query(
          `insert into guests (id, family_id, name, category, position) values ($1, $2, $3, $4, $5)
           on conflict(id) do update set name = excluded.name, category = excluded.category, position = excluded.position
           where guests.family_id = excluded.family_id`,
          [guestId, familyId, guest.name?.trim(), guest.category, position]
        );
      }
      await client.query('delete from guests where family_id = $1 and not (id = any($2::text[]))', [familyId, keptIds]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    const saved = (await readFamilies()).find((family) => family.id === familyId);
    return reply.code(201).send(saved);
  });

  app.post('/api/admin/families/:id/regenerate-link', async (request, reply) => {
    if (!requireAdmin(request.headers.authorization, reply)) {
      return;
    }

    const { id } = request.params as { id: string };
    const result = await database.query('update families set code = $1 where id = $2', [generateFamilyCode(), id]);
    if (!result.rowCount) {
      return reply.code(404).send({ error: 'Família não encontrada.' });
    }
    return (await readFamilies()).find((family) => family.id === id);
  });

  app.delete('/api/admin/families/:id', async (request, reply) => {
    if (!requireAdmin(request.headers.authorization, reply)) {
      return;
    }

    const { id } = request.params as { id: string };
    await database.query('delete from families where id = $1', [id]);
    return reply.code(204).send();
  });

  app.post('/api/admin/images/signature', async (request, reply) => {
    if (!requireAdmin(request.headers.authorization, reply)) {
      return;
    }

    const cloudName = process.env['CLOUDINARY_CLOUD_NAME'];
    const apiKey = process.env['CLOUDINARY_API_KEY'];
    const apiSecret = process.env['CLOUDINARY_API_SECRET'];
    if (!cloudName || !apiKey || !apiSecret) {
      return reply.code(503).send({ error: 'Cloudinary não configurado.' });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = process.env['CLOUDINARY_GIFTS_FOLDER'] || 'Gifts';
    const signature = createHash('sha1')
      .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex');
    return { cloudName, apiKey, timestamp, folder, signature };
  });

  await app.listen({
    port: Number(process.env['PORT'] || 3003),
    host: '0.0.0.0'
  });
}

void start().catch(async (error: unknown) => {
  app.log.error(error, 'Backend startup failed');
  await database.end();
  process.exitCode = 1;
});