const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'treewalley-admin-key';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const products = [
  {
    id: 'tw-bed-king-1',
    name: 'TreeWalley Sheesham King Bed',
    category: 'Beds',
    price: 38999,
    material: 'Sheesham',
    size: 'King',
    stock: 12,
    rating: 4.6,
    images: [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1631048500397-e650d0292451?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Solid Sheesham king bed with hydraulic storage.',
    specs: { finish: 'Walnut', warranty: '3 years', assembly: 'Carpenter required' }
  },
  {
    id: 'tw-sofa-3-1',
    name: 'TreeWalley Premium Sofa 3 Seater',
    category: 'Sofa',
    price: 45999,
    material: 'Engineered Wood',
    size: '3 Seater',
    stock: 8,
    rating: 4.4,
    images: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1549187774-b4e9b0445b41?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Contemporary 3 seater with high density foam and fabric upholstery.',
    specs: { finish: 'Teak tone', warranty: '2 years', assembly: 'Pre-assembled' }
  },
  {
    id: 'tw-cabinet-1',
    name: 'TreeWalley Display Cabinet',
    category: 'Cabinet',
    price: 22999,
    material: 'Sheesham',
    size: 'Large',
    stock: 6,
    rating: 4.2,
    images: [
      'https://images.unsplash.com/photo-1616628182509-6f50fdd6d7d9?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1577140917170-285929fb55b7?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Glass-door cabinet for collectibles and storage.',
    specs: { finish: 'Honey', warranty: '3 years', assembly: 'Knock-down' }
  },
  {
    id: 'tw-table-1',
    name: 'TreeWalley Dining Table 6 Seater',
    category: 'Dining',
    price: 29999,
    material: 'Engineered Wood',
    size: '6 Seater',
    stock: 15,
    rating: 4.3,
    images: [
      'https://images.unsplash.com/photo-1617104678098-de229db51175?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=1200&q=80'
    ],
    description: 'Spacious dining table for family meals.',
    specs: { finish: 'Mahogany', warranty: '2 years', assembly: 'Carpenter required' }
  }
];

const faqs = [
  { q: 'How long is delivery?', a: '3-7 business days in major Indian cities.' },
  { q: 'Do you offer assembly?', a: 'Yes, free assembly on selected products.' }
];

const policies = {
  privacy: 'We collect only essential customer and order data for fulfilment and support.',
  terms: 'By placing an order, you agree to payment, delivery and return terms.',
  returns: '7-day return/replacement for damaged/incorrect products. T&C apply.',
  warranty: 'TreeWalley furniture has 1-3 years warranty depending on product.',
  gst: 'GST invoice is generated for every prepaid/COD delivered order.'
};

const otpSessions = new Map();
const tokens = new Map();
const users = new Map(); // userId -> user
const orders = new Map();
const paymentSessions = new Map();
const coupons = new Map([
  ['TREE10', { code: 'TREE10', type: 'PERCENT', value: 10, maxDiscount: 5000, active: true }],
  ['SOFA2000', { code: 'SOFA2000', type: 'FLAT', value: 2000, active: true }]
]);

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function otp() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function applyCoupon(total, code) {
  if (!code) return { total, discount: 0, couponCode: null };
  const coupon = coupons.get(code.toUpperCase());
  if (!coupon || !coupon.active) return { total, discount: 0, couponCode: null, error: 'Invalid coupon' };

  let discount = 0;
  if (coupon.type === 'PERCENT') discount = Math.round((total * coupon.value) / 100);
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  if (coupon.type === 'FLAT') discount = coupon.value;

  return { total: Math.max(0, total - discount), discount, couponCode: coupon.code };
}

function getUserFromToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  return tokens.get(token) || null;
}

function requireAuth(req, res, next) {
  const user = getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) return res.status(403).json({ error: 'Admin only' });
  next();
}

function userSafe(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    addresses: user.addresses,
    wishlist: user.wishlist
  };
}


app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'treewalley-furniture', ts: new Date().toISOString() });
});

app.get('/api/catalog/meta', (_req, res) => {
  const categories = [...new Set(products.map((p) => p.category))];
  const materials = [...new Set(products.map((p) => p.material))];
  const sizes = [...new Set(products.map((p) => p.size))];
  res.json({ categories, materials, sizes });
});

app.get('/api/products', (req, res) => {
  const {
    category,
    material,
    size,
    minPrice,
    maxPrice,
    search,
    sort = 'relevance'
  } = req.query;

  let filtered = [...products];
  if (category) filtered = filtered.filter((p) => p.category.toLowerCase() === String(category).toLowerCase());
  if (material) filtered = filtered.filter((p) => p.material.toLowerCase() === String(material).toLowerCase());
  if (size) filtered = filtered.filter((p) => p.size.toLowerCase() === String(size).toLowerCase());
  if (minPrice) filtered = filtered.filter((p) => p.price >= Number(minPrice));
  if (maxPrice) filtered = filtered.filter((p) => p.price <= Number(maxPrice));
  if (search) {
    const q = String(search).toLowerCase();
    filtered = filtered.filter((p) =>
      `${p.name} ${p.description} ${p.category} ${p.material} ${p.size}`.toLowerCase().includes(q)
    );
  }

  if (sort === 'price_asc') filtered.sort((a, b) => a.price - b.price);
  if (sort === 'price_desc') filtered.sort((a, b) => b.price - a.price);
  if (sort === 'rating_desc') filtered.sort((a, b) => b.rating - a.rating);

  res.json({ products: filtered });
});

app.get('/api/products/:id', (req, res) => {
  const product = products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const similar = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 3);
  const recommended = [...products].sort((a, b) => b.rating - a.rating).slice(0, 3);
  res.json({ product, similar, recommended });
});

app.post('/api/auth/signup', (req, res) => {
  const { name, phone, email, password } = req.body;
  if (!name || !phone || !email || !password) return res.status(400).json({ error: 'All fields required' });
  const existing = [...users.values()].find((u) => u.phone === phone || u.email === email);
  if (existing) return res.status(400).json({ error: 'User already exists' });

  const user = { id: id('usr'), name, phone, email, password, addresses: [], wishlist: [], createdAt: new Date().toISOString() };
  users.set(user.id, user);
  res.status(201).json({ user: userSafe(user), message: 'Signup successful' });
});

app.post('/api/auth/login', (req, res) => {
  const { emailOrPhone, password } = req.body;
  const user = [...users.values()].find((u) => (u.email === emailOrPhone || u.phone === emailOrPhone) && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = id('token');
  tokens.set(token, user);
  res.json({ token, user: userSafe(user) });
});

app.post('/api/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\+?[0-9]{10,15}$/.test(phone)) return res.status(400).json({ error: 'Valid phone required' });
  const sessionId = id('otp');
  const code = otp();
  otpSessions.set(sessionId, { phone, code, expiresAt: Date.now() + 300000 });
  res.json({ sessionId, demoOtp: code });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { sessionId, otp: userOtp, name = 'OTP User', email } = req.body;
  const session = otpSessions.get(sessionId);
  if (!session) return res.status(400).json({ error: 'Invalid session' });
  if (session.expiresAt < Date.now()) return res.status(400).json({ error: 'OTP expired' });
  if (session.code !== userOtp) return res.status(400).json({ error: 'Incorrect OTP' });

  let user = [...users.values()].find((u) => u.phone === session.phone);
  if (!user) {
    user = {
      id: id('usr'),
      name,
      phone: session.phone,
      email: email || `${session.phone.replace('+', '')}@treewalley.local`,
      password: null,
      addresses: [],
      wishlist: [],
      createdAt: new Date().toISOString()
    };
    users.set(user.id, user);
  }

  const token = id('token');
  tokens.set(token, user);
  otpSessions.delete(sessionId);
  res.json({ token, user: userSafe(user) });
});

app.get('/api/account/me', requireAuth, (req, res) => res.json({ user: userSafe(req.user) }));

app.post('/api/account/addresses', requireAuth, (req, res) => {
  const { name, line1, city, state, pincode, phone } = req.body;
  if (!name || !line1 || !city || !state || !pincode || !phone) return res.status(400).json({ error: 'Complete address required' });
  const addr = { id: id('addr'), name, line1, city, state, pincode, phone };
  req.user.addresses.push(addr);
  res.status(201).json({ address: addr, addresses: req.user.addresses });
});

app.get('/api/account/orders', requireAuth, (req, res) => {
  const myOrders = [...orders.values()].filter((o) => o.userId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ orders: myOrders });
});

app.get('/api/account/wishlist', requireAuth, (req, res) => {
  const list = req.user.wishlist.map((id) => products.find((p) => p.id === id)).filter(Boolean);
  res.json({ wishlist: list });
});

app.post('/api/account/wishlist/:productId', requireAuth, (req, res) => {
  const product = products.find((p) => p.id === req.params.productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (!req.user.wishlist.includes(product.id)) req.user.wishlist.push(product.id);
  res.json({ wishlist: req.user.wishlist });
});

app.delete('/api/account/wishlist/:productId', requireAuth, (req, res) => {
  req.user.wishlist = req.user.wishlist.filter((id) => id !== req.params.productId);
  res.json({ wishlist: req.user.wishlist });
});

app.post('/api/coupons/validate', (req, res) => {
  const { code, total } = req.body;
  const result = applyCoupon(Number(total || 0), code);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result);
});

app.post('/api/orders', requireAuth, (req, res) => {
  const { items, addressId, couponCode, paymentMode = 'UPI' } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Cart items required' });
  const address = req.user.addresses.find((a) => a.id === addressId) || req.user.addresses[0];
  if (!address) return res.status(400).json({ error: 'Address required' });

  let total = 0;
  const finalItems = [];
  for (const i of items) {
    const p = products.find((x) => x.id === i.productId);
    const qty = Number(i.quantity || 0);
    if (!p || qty <= 0 || !Number.isInteger(qty)) return res.status(400).json({ error: 'Invalid cart item' });
    if (p.stock < qty) return res.status(400).json({ error: `${p.name} stock insufficient` });
    total += p.price * qty;
    finalItems.push({ productId: p.id, name: p.name, quantity: qty, unitPrice: p.price, subtotal: p.price * qty });
  }

  const couponResult = applyCoupon(total, couponCode);
  const shippingFee = couponResult.total > 30000 ? 0 : 499;
  const grandTotal = couponResult.total + shippingFee;

  const order = {
    id: id('ord'),
    invoiceNo: `INV-${Date.now()}`,
    userId: req.user.id,
    items: finalItems,
    address,
    paymentMode,
    paymentGateway: null,
    discount: couponResult.discount,
    couponCode: couponResult.couponCode,
    subtotal: total,
    shippingFee,
    total: grandTotal,
    status: paymentMode === 'COD' ? 'PLACED_COD' : 'PENDING_PAYMENT',
    trackingId: `TRK${Math.floor(Math.random() * 1000000)}`,
    timeline: [
      { status: 'Order Created', at: new Date().toISOString() }
    ],
    returnRequested: false,
    createdAt: new Date().toISOString()
  };

  if (paymentMode === 'COD') {
    for (const i of finalItems) {
      const p = products.find((x) => x.id === i.productId);
      p.stock -= i.quantity;
    }
    order.timeline.push({ status: 'COD Confirmed', at: new Date().toISOString() });
  }

  orders.set(order.id, order);
  res.status(201).json({ order });
});

app.post('/api/payment/initiate', requireAuth, (req, res) => {
  const { orderId, gateway, mode, upiId, cardNumber, bankName } = req.body;
  const allowedGateways = ['Razorpay', 'PayU', 'Cashfree'];
  const allowedModes = ['UPI', 'Card', 'NetBanking'];
  if (!allowedGateways.includes(gateway)) return res.status(400).json({ error: 'Unsupported gateway' });
  if (!allowedModes.includes(mode)) return res.status(400).json({ error: 'Unsupported payment mode' });

  const order = orders.get(orderId);
  if (!order || order.userId !== req.user.id) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'PENDING_PAYMENT') return res.status(400).json({ error: 'Order not pending payment' });

  if (mode === 'UPI' && !upiId) return res.status(400).json({ error: 'UPI ID required' });
  if (mode === 'Card' && !cardNumber) return res.status(400).json({ error: 'Card number required' });
  if (mode === 'NetBanking' && !bankName) return res.status(400).json({ error: 'Bank name required' });

  const psid = id('pay');
  const code = otp();
  paymentSessions.set(psid, { orderId, code, expiresAt: Date.now() + 180000, gateway, mode });
  order.paymentGateway = gateway;
  order.paymentMode = mode;

  res.json({ paymentSessionId: psid, gateway, mode, demoOtp: code, message: 'OTP sent by mock gateway' });
});

app.post('/api/payment/verify-otp', requireAuth, (req, res) => {
  const { paymentSessionId, otp: userOtp } = req.body;
  const ps = paymentSessions.get(paymentSessionId);
  if (!ps) return res.status(400).json({ error: 'Invalid payment session' });
  if (ps.expiresAt < Date.now()) return res.status(400).json({ error: 'OTP expired' });
  if (ps.code !== userOtp) return res.status(400).json({ error: 'Incorrect OTP' });

  const order = orders.get(ps.orderId);
  if (!order || order.userId !== req.user.id) return res.status(404).json({ error: 'Order not found' });

  order.status = 'PAID';
  order.timeline.push({ status: `Payment success via ${ps.gateway} (${ps.mode})`, at: new Date().toISOString() });
  order.timeline.push({ status: 'Packed', at: new Date(Date.now() + 3600000).toISOString() });
  order.timeline.push({ status: 'Shipped via Shiprocket/Delhivery mock', at: new Date(Date.now() + 7200000).toISOString() });

  for (const i of order.items) {
    const p = products.find((x) => x.id === i.productId);
    p.stock -= i.quantity;
  }

  paymentSessions.delete(paymentSessionId);
  res.json({ message: 'Payment successful', order });
});

app.get('/api/orders/:id', requireAuth, (req, res) => {
  const order = orders.get(req.params.id);
  if (!order || order.userId !== req.user.id) return res.status(404).json({ error: 'Order not found' });
  res.json({ order, invoice: `Invoice ${order.invoiceNo} | Total ₹${order.total} | GST included` });
});

app.get('/api/tracking/:trackingId', requireAuth, (req, res) => {
  const order = [...orders.values()].find((o) => o.trackingId === req.params.trackingId && o.userId === req.user.id);
  if (!order) return res.status(404).json({ error: 'Tracking not found' });
  res.json({ trackingId: order.trackingId, status: order.status, timeline: order.timeline });
});

app.post('/api/orders/:id/return', requireAuth, (req, res) => {
  const { reason } = req.body;
  const order = orders.get(req.params.id);
  if (!order || order.userId !== req.user.id) return res.status(404).json({ error: 'Order not found' });
  order.returnRequested = true;
  order.returnReason = reason || 'No reason provided';
  order.status = 'RETURN_REQUESTED';
  order.timeline.push({ status: 'Return requested', at: new Date().toISOString() });
  res.json({ message: 'Return/replacement request submitted', order });
});

app.post('/api/reviews', requireAuth, (req, res) => {
  const { productId, rating, comment } = req.body;
  const p = products.find((x) => x.id === productId);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  if (Number(rating) < 1 || Number(rating) > 5) return res.status(400).json({ error: 'Rating 1-5 only' });
  if (!p.reviews) p.reviews = [];
  p.reviews.push({ id: id('rev'), userId: req.user.id, rating: Number(rating), comment: comment || '', at: new Date().toISOString() });
  const avg = p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length;
  p.rating = Number(avg.toFixed(1));
  res.status(201).json({ rating: p.rating, reviews: p.reviews });
});

app.get('/api/content/faq', (_req, res) => res.json({ faqs }));
app.get('/api/content/policies', (_req, res) => res.json(policies));

app.post('/api/notifications', requireAuth, (req, res) => {
  const { channel, message } = req.body;
  if (!['Email', 'WhatsApp'].includes(channel)) return res.status(400).json({ error: 'Channel must be Email or WhatsApp' });
  res.json({ sent: true, channel, to: channel === 'Email' ? req.user.email : req.user.phone, message: message || 'TreeWalley update' });
});

app.post('/api/marketing/pixel', (req, res) => {
  res.status(201).json({ tracked: true, event: req.body.event || 'PageView', ts: new Date().toISOString() });
});

app.get('/api/seo/meta', (_req, res) => {
  res.json({ title: 'TreeWalley Furniture | Buy Beds, Sofa, Cabinet Online', description: 'Premium TreeWalley furniture with secure checkout and fast delivery.' });
});

app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
  const allOrders = [...orders.values()];
  const revenue = allOrders.filter((o) => ['PAID', 'PLACED_COD'].includes(o.status)).reduce((s, o) => s + o.total, 0);
  res.json({
    productsCount: products.length,
    ordersCount: allOrders.length,
    paidOrders: allOrders.filter((o) => o.status === 'PAID').length,
    codOrders: allOrders.filter((o) => o.status === 'PLACED_COD').length,
    returns: allOrders.filter((o) => o.returnRequested).length,
    revenue
  });
});

app.get('/api/admin/orders', requireAdmin, (_req, res) => res.json({ orders: [...orders.values()] }));
app.get('/api/admin/customers', requireAdmin, (_req, res) => res.json({ customers: [...users.values()].map(userSafe) }));

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name, category, price, material, size, stock = 0 } = req.body;
  if (!name || !category || !price || !material || !size) return res.status(400).json({ error: 'Missing fields' });
  const p = {
    id: id('prd'),
    name,
    category,
    price: Number(price),
    material,
    size,
    stock: Number(stock),
    rating: 0,
    images: req.body.images || [],
    description: req.body.description || '',
    specs: req.body.specs || {}
  };
  products.push(p);
  res.status(201).json({ product: p });
});

app.patch('/api/admin/products/:id', requireAdmin, (req, res) => {
  const p = products.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  Object.assign(p, req.body);
  res.json({ product: p });
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

if (require.main === module) {
  app.listen(PORT, () => console.log(`TreeWalley app running at http://localhost:${PORT}`));
}

module.exports = app;
