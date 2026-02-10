const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const products = [
  {
    id: 'tw-sofa-1',
    name: 'TreeWalley Royal Teak Sofa Set',
    category: 'Living Room',
    price: 45999,
    stock: 8,
    image:
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=80',
    description: 'Premium handcrafted teak wood sofa set with plush cushions.'
  },
  {
    id: 'tw-bed-1',
    name: 'TreeWalley Solid Wood King Bed',
    category: 'Bedroom',
    price: 38999,
    stock: 12,
    image:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
    description: 'Durable king-size bed frame made with seasoned Sheesham wood.'
  },
  {
    id: 'tw-table-1',
    name: 'TreeWalley Dining Table 6-Seater',
    category: 'Dining',
    price: 29999,
    stock: 5,
    image:
      'https://images.unsplash.com/photo-1617104678098-de229db51175?auto=format&fit=crop&w=900&q=80',
    description: 'Elegant 6-seater dining set with smooth walnut finish.'
  },
  {
    id: 'tw-chair-1',
    name: 'TreeWalley Ergonomic Lounge Chair',
    category: 'Office',
    price: 11999,
    stock: 20,
    image:
      'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=80',
    description: 'Contemporary lounge chair designed for long sitting comfort.'
  }
];

const otpSessions = new Map();
const paymentSessions = new Map();
const tokens = new Map();
const orders = new Map();

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function generateOtp() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  const token = auth.slice(7);
  const user = tokens.get(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid auth token' });
  }

  req.user = user;
  next();
}

app.get('/api/products', (_req, res) => {
  res.json({ products });
});

app.post('/api/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\+?[0-9]{10,15}$/.test(phone)) {
    return res.status(400).json({ error: 'Valid phone number is required' });
  }

  const sessionId = id('otp');
  const otp = generateOtp();
  otpSessions.set(sessionId, {
    phone,
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000
  });

  // Demo app: return OTP in response.
  res.json({
    sessionId,
    message: 'OTP sent successfully',
    demoOtp: otp
  });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { sessionId, otp } = req.body;
  const session = otpSessions.get(sessionId);

  if (!session) {
    return res.status(400).json({ error: 'Invalid OTP session' });
  }

  if (Date.now() > session.expiresAt) {
    otpSessions.delete(sessionId);
    return res.status(400).json({ error: 'OTP expired' });
  }

  if (session.otp !== otp) {
    return res.status(400).json({ error: 'Incorrect OTP' });
  }

  const token = id('token');
  const user = { id: id('user'), phone: session.phone };
  tokens.set(token, user);
  otpSessions.delete(sessionId);

  res.json({ token, user, message: 'OTP verified. Login successful.' });
});

app.post('/api/orders', requireAuth, (req, res) => {
  const { items, shippingAddress } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart items are required' });
  }

  if (!shippingAddress || !shippingAddress.name || !shippingAddress.address || !shippingAddress.city || !shippingAddress.pincode) {
    return res.status(400).json({ error: 'Complete shipping address is required' });
  }

  let total = 0;
  const validatedItems = [];

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    const quantity = Number(item.quantity);

    if (!product || !Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: `Invalid cart item: ${item.productId}` });
    }

    if (quantity > product.stock) {
      return res.status(400).json({ error: `${product.name} is out of stock for quantity ${quantity}` });
    }

    total += product.price * quantity;
    validatedItems.push({
      productId: product.id,
      name: product.name,
      quantity,
      unitPrice: product.price,
      subtotal: product.price * quantity
    });
  }

  const orderId = id('order');
  const order = {
    id: orderId,
    userId: req.user.id,
    items: validatedItems,
    shippingAddress,
    total,
    status: 'PENDING_PAYMENT',
    createdAt: new Date().toISOString()
  };

  orders.set(orderId, order);
  res.status(201).json({ order });
});

app.post('/api/payment/initiate', requireAuth, (req, res) => {
  const { orderId, cardNumber, cardHolder, expiry, cvv } = req.body;
  const order = orders.get(orderId);

  if (!order || order.userId !== req.user.id) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (order.status !== 'PENDING_PAYMENT') {
    return res.status(400).json({ error: 'Order is not awaiting payment' });
  }

  if (!cardNumber || !cardHolder || !expiry || !cvv) {
    return res.status(400).json({ error: 'Complete card details are required' });
  }

  const paymentSessionId = id('pay');
  const otp = generateOtp();

  paymentSessions.set(paymentSessionId, {
    orderId,
    otp,
    expiresAt: Date.now() + 3 * 60 * 1000
  });

  res.json({
    paymentSessionId,
    message: 'Payment OTP sent',
    demoOtp: otp
  });
});

app.post('/api/payment/verify-otp', requireAuth, (req, res) => {
  const { paymentSessionId, otp } = req.body;
  const session = paymentSessions.get(paymentSessionId);

  if (!session) {
    return res.status(400).json({ error: 'Invalid payment session' });
  }

  if (Date.now() > session.expiresAt) {
    paymentSessions.delete(paymentSessionId);
    return res.status(400).json({ error: 'Payment OTP expired' });
  }

  if (session.otp !== otp) {
    return res.status(400).json({ error: 'Incorrect payment OTP' });
  }

  const order = orders.get(session.orderId);
  if (!order || order.userId !== req.user.id) {
    return res.status(404).json({ error: 'Order not found for this user' });
  }

  order.status = 'PAID';
  order.paidAt = new Date().toISOString();

  paymentSessions.delete(paymentSessionId);

  res.json({ message: 'Payment successful', order });
});

app.get('/api/orders/:id', requireAuth, (req, res) => {
  const order = orders.get(req.params.id);
  if (!order || order.userId !== req.user.id) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json({ order });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`TreeWalley Furniture app running at http://localhost:${PORT}`);
  });
}

module.exports = app;
