const state = {
  token: null,
  otpSessionId: null,
  products: [],
  cart: [],
  addressId: null,
  couponCode: null,
  orderId: null,
  paymentSessionId: null
};

const $ = (id) => document.getElementById(id);
const statusEl = $('status');

function log(message, data) {
  statusEl.textContent = `${message}${data ? `\n${JSON.stringify(data, null, 2)}` : ''}`;
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const r = await fetch(path, { ...options, headers });
  const b = await r.json();
  if (!r.ok) throw new Error(b.error || 'Request failed');
  return b;
}

const inr = (v) => `₹${Number(v).toLocaleString('en-IN')}`;

function cartTotal() {
  return state.cart.reduce((sum, i) => {
    const p = state.products.find((x) => x.id === i.productId);
    return sum + (p ? p.price * i.quantity : 0);
  }, 0);
}

function renderProducts() {
  $('products').innerHTML = '';
  state.products.forEach((p) => {
    const el = document.createElement('article');
    el.className = 'card';
    el.innerHTML = `
      <img src="${p.images[0]}" alt="${p.name}" />
      <h3>${p.name}</h3>
      <p>${p.category} • ${p.material} • ${p.size}</p>
      <p><b>${inr(p.price)}</b> | ⭐ ${p.rating} | Stock ${p.stock}</p>
      <details><summary>Description + Specs</summary><p>${p.description}</p><pre>${JSON.stringify(p.specs, null, 2)}</pre></details>
      <div class="grid2">
        <button data-add="${p.id}">Add Cart</button>
        <button data-wish="${p.id}">Wishlist</button>
        <button data-view="${p.id}">View Similar/Recommended</button>
      </div>
      <small>Image zoom: open image in new tab for high-res view.</small>
    `;

    el.querySelector('[data-add]').onclick = () => {
      const e = state.cart.find((c) => c.productId === p.id);
      if (e) e.quantity += 1;
      else state.cart.push({ productId: p.id, quantity: 1 });
      $('cartCount').textContent = String(state.cart.reduce((a, b) => a + b.quantity, 0));
      renderCart();
    };

    el.querySelector('[data-wish]').onclick = async () => {
      try {
        await api(`/api/account/wishlist/${p.id}`, { method: 'POST' });
        log('Added to wishlist');
      } catch (e) { log(e.message); }
    };

    el.querySelector('[data-view]').onclick = async () => {
      try {
        const data = await api(`/api/products/${p.id}`);
        log('Product detail + similar + recommended', data);
      } catch (e) { log(e.message); }
    };

    $('products').appendChild(el);
  });
}

function renderCart() {
  if (!state.cart.length) return ($('cartItems').textContent = 'Cart empty');
  const lines = state.cart.map((i) => {
    const p = state.products.find((x) => x.id === i.productId);
    return `${p.name} x ${i.quantity} = ${inr(p.price * i.quantity)}`;
  });
  $('cartItems').textContent = `${lines.join('\n')}\n\nSubtotal: ${inr(cartTotal())}`;
}

async function loadMeta() {
  const meta = await api('/api/catalog/meta');
  ['category', 'material', 'size'].forEach((k) => {
    const sel = $(`${k}Filter`);
    meta[`${k}s`].forEach((v) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      sel.appendChild(o);
    });
  });
}

async function loadProducts() {
  const q = new URLSearchParams();
  const add = (key, val) => { if (val) q.set(key, val); };
  add('search', $('searchInput').value.trim());
  add('category', $('categoryFilter').value);
  add('material', $('materialFilter').value);
  add('size', $('sizeFilter').value);
  add('minPrice', $('minPrice').value);
  add('maxPrice', $('maxPrice').value);
  add('sort', $('sortFilter').value);

  const data = await api(`/api/products?${q.toString()}`);
  state.products = data.products;
  renderProducts();
}

$('searchBtn').onclick = () => loadProducts().catch((e) => log(e.message));
$('applyFilters').onclick = () => loadProducts().catch((e) => log(e.message));
$('clearFilters').onclick = () => {
  ['searchInput', 'categoryFilter', 'materialFilter', 'sizeFilter', 'minPrice', 'maxPrice'].forEach((id) => $(id).value = '');
  $('sortFilter').value = 'relevance';
  loadProducts().catch((e) => log(e.message));
};

$('cartBtn').onclick = () => { $('cartSection').classList.toggle('hidden'); renderCart(); };

const authDialog = $('authDialog');
$('loginBtn').onclick = () => authDialog.showModal();
$('closeAuth').onclick = () => authDialog.close();

$('signupForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const out = await api('/api/auth/signup', { method: 'POST', body: JSON.stringify(payload) });
    log('Signup success', out);
  } catch (err) { log(err.message); }
};

$('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const out = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    state.token = out.token;
    authDialog.close();
    log('Login success', out.user);
  } catch (err) { log(err.message); }
};

$('sendOtpForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const out = await api('/api/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone: e.target.phone.value }) });
    state.otpSessionId = out.sessionId;
    $('verifyOtpForm').classList.remove('hidden');
    log('OTP sent', out);
  } catch (err) { log(err.message); }
};

$('verifyOtpForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const out = await api('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ sessionId: state.otpSessionId, otp: e.target.otp.value })
    });
    state.token = out.token;
    authDialog.close();
    log('OTP login success', out.user);
  } catch (err) { log(err.message); }
};

$('addressForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const out = await api('/api/account/addresses', { method: 'POST', body: JSON.stringify(payload) });
    state.addressId = out.address.id;
    log('Address saved', out.address);
  } catch (err) { log(err.message); }
};

$('applyCouponBtn').onclick = async () => {
  try {
    const code = $('couponInput').value.trim();
    const out = await api('/api/coupons/validate', { method: 'POST', body: JSON.stringify({ code, total: cartTotal() }) });
    state.couponCode = out.couponCode;
    log('Coupon applied', out);
  } catch (err) { log(err.message); }
};

$('placeOrderBtn').onclick = async () => {
  try {
    const out = await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        items: state.cart,
        addressId: state.addressId,
        couponCode: state.couponCode,
        paymentMode: $('orderPaymentMode').value
      })
    });

    state.orderId = out.order.id;
    log('Order placed', out.order);

    if (out.order.paymentMode === 'COD') {
      await api('/api/notifications', { method: 'POST', body: JSON.stringify({ channel: 'WhatsApp', message: `COD order ${out.order.id} placed` }) });
      return;
    }

    $('paymentSection').classList.remove('hidden');
  } catch (err) { log(err.message); }
};

$('paymentForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const payload = Object.fromEntries(new FormData(e.target).entries());
    payload.orderId = state.orderId;
    const out = await api('/api/payment/initiate', { method: 'POST', body: JSON.stringify(payload) });
    state.paymentSessionId = out.paymentSessionId;
    $('paymentOtpForm').classList.remove('hidden');
    log('Payment initiated', out);
  } catch (err) { log(err.message); }
};

$('paymentOtpForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const out = await api('/api/payment/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ paymentSessionId: state.paymentSessionId, otp: new FormData(e.target).get('otp') })
    });

    const orderData = await api(`/api/orders/${state.orderId}`);
    const trackingData = await api(`/api/tracking/${out.order.trackingId}`);
    await api('/api/notifications', { method: 'POST', body: JSON.stringify({ channel: 'Email', message: `Invoice ${out.order.invoiceNo}` }) });
    await api('/api/marketing/pixel', { method: 'POST', body: JSON.stringify({ event: 'Purchase', orderId: out.order.id }) });
    log('Payment complete + invoice + tracking', { payment: out, invoice: orderData.invoice, tracking: trackingData });

    state.cart = [];
    $('cartCount').textContent = '0';
    renderCart();
  } catch (err) { log(err.message); }
};

$('wishlistBtn').onclick = async () => {
  try { log('Wishlist', await api('/api/account/wishlist')); } catch (e) { log(e.message); }
};

$('ordersBtn').onclick = async () => {
  try { log('Order history', await api('/api/account/orders')); } catch (e) { log(e.message); }
};

$('reviewForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const payload = Object.fromEntries(new FormData(e.target).entries());
    log('Review submitted', await api('/api/reviews', { method: 'POST', body: JSON.stringify(payload) }));
  } catch (err) { log(err.message); }
};

$('loadFaqBtn').onclick = async () => log('FAQ', await api('/api/content/faq'));
$('loadPoliciesBtn').onclick = async () => log('Policies', await api('/api/content/policies'));

$('adminStatsBtn').onclick = async () => {
  try {
    const stats = await api('/api/admin/dashboard', { headers: { 'x-admin-key': 'treewalley-admin-key' } });
    log('Admin sales report', stats);
  } catch (err) { log(err.message); }
};

(async () => {
  try {
    const seo = await api('/api/seo/meta');
    document.title = seo.title;
    await loadMeta();
    await loadProducts();
    log('App loaded with SEO metadata', seo);
  } catch (err) {
    log(err.message);
  }
})();
