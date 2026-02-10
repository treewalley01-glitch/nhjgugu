const state = {
  products: [],
  cart: [],
  token: null,
  otpSessionId: null,
  orderId: null,
  paymentSessionId: null
};

const productsEl = document.getElementById('products');
const cartCountEl = document.getElementById('cartCount');
const statusEl = document.getElementById('status');
const checkoutItemsEl = document.getElementById('checkoutItems');
const checkoutSection = document.getElementById('checkoutSection');
const paymentSection = document.getElementById('paymentSection');
const paymentOtpForm = document.getElementById('paymentOtpForm');

function setStatus(message, object) {
  statusEl.textContent = object ? `${message}\n${JSON.stringify(object, null, 2)}` : message;
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(path, { ...options, headers });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
}

function money(v) {
  return `₹${v.toLocaleString('en-IN')}`;
}

function renderProducts() {
  productsEl.innerHTML = '';
  state.products.forEach((p) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <img src="${p.image}" alt="${p.name}" />
      <h3>${p.name}</h3>
      <p>${p.description}</p>
      <p><strong>${money(p.price)}</strong> • Stock: ${p.stock}</p>
      <button>Add to Cart</button>
    `;
    card.querySelector('button').onclick = () => addToCart(p.id);
    productsEl.appendChild(card);
  });
}

function addToCart(productId) {
  const existing = state.cart.find((c) => c.productId === productId);
  if (existing) existing.quantity += 1;
  else state.cart.push({ productId, quantity: 1 });
  renderCart();
  setStatus('Added item to cart');
}

function renderCart() {
  cartCountEl.textContent = String(state.cart.reduce((a, b) => a + b.quantity, 0));

  if (!state.cart.length) {
    checkoutItemsEl.textContent = 'Cart is empty.';
    return;
  }

  const rows = state.cart.map((item) => {
    const product = state.products.find((p) => p.id === item.productId);
    return `${product.name} x${item.quantity} = ${money(product.price * item.quantity)}`;
  });
  const total = state.cart.reduce((sum, item) => {
    const p = state.products.find((prod) => prod.id === item.productId);
    return sum + p.price * item.quantity;
  }, 0);

  checkoutItemsEl.textContent = `${rows.join('\n')}\n\nTotal: ${money(total)}`;
}

async function loadProducts() {
  const data = await api('/api/products');
  state.products = data.products;
  renderProducts();
}

document.getElementById('cartBtn').onclick = () => {
  checkoutSection.classList.toggle('hidden');
  renderCart();
};

const loginDialog = document.getElementById('loginDialog');
document.getElementById('loginBtn').onclick = () => loginDialog.showModal();
document.getElementById('closeLogin').onclick = () => loginDialog.close();

document.getElementById('otpSendForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const phone = e.target.phone.value.trim();
    const data = await api('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone })
    });
    state.otpSessionId = data.sessionId;
    document.getElementById('otpVerifyForm').classList.remove('hidden');
    setStatus('Login OTP sent. Demo OTP shown below:', data);
  } catch (err) {
    setStatus(`OTP send failed: ${err.message}`);
  }
};

document.getElementById('otpVerifyForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const otp = e.target.otp.value.trim();
    const data = await api('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ sessionId: state.otpSessionId, otp })
    });
    state.token = data.token;
    loginDialog.close();
    setStatus('Login successful', data.user);
  } catch (err) {
    setStatus(`OTP verify failed: ${err.message}`);
  }
};

document.getElementById('shippingForm').onsubmit = async (e) => {
  e.preventDefault();
  if (!state.token) {
    setStatus('Please login first.');
    return;
  }
  if (!state.cart.length) {
    setStatus('Cart is empty.');
    return;
  }

  try {
    const shippingAddress = {
      name: e.target.name.value.trim(),
      address: e.target.address.value.trim(),
      city: e.target.city.value.trim(),
      pincode: e.target.pincode.value.trim()
    };

    const data = await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ items: state.cart, shippingAddress })
    });

    state.orderId = data.order.id;
    paymentSection.classList.remove('hidden');
    setStatus('Order placed. Continue to payment.', data.order);
  } catch (err) {
    setStatus(`Order failed: ${err.message}`);
  }
};

document.getElementById('paymentForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const payload = {
      orderId: state.orderId,
      cardNumber: e.target.cardNumber.value.trim(),
      cardHolder: e.target.cardHolder.value.trim(),
      expiry: e.target.expiry.value.trim(),
      cvv: e.target.cvv.value.trim()
    };
    const data = await api('/api/payment/initiate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.paymentSessionId = data.paymentSessionId;
    paymentOtpForm.classList.remove('hidden');
    setStatus('Payment OTP sent. Demo OTP shown below:', data);
  } catch (err) {
    setStatus(`Payment initiation failed: ${err.message}`);
  }
};

paymentOtpForm.onsubmit = async (e) => {
  e.preventDefault();
  try {
    const otp = e.target.otp.value.trim();
    const data = await api('/api/payment/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ paymentSessionId: state.paymentSessionId, otp })
    });
    state.cart = [];
    renderCart();
    paymentOtpForm.classList.add('hidden');
    setStatus('✅ Payment successful. Order complete.', data.order);
  } catch (err) {
    setStatus(`Payment OTP verify failed: ${err.message}`);
  }
};

loadProducts().catch((err) => setStatus(`Failed to load products: ${err.message}`));
