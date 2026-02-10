const test = require('node:test');
const assert = require('node:assert/strict');

const app = require('../server');

const PORT = 3100;
const base = `http://127.0.0.1:${PORT}`;

let server;

test.before(() => {
  server = app.listen(PORT);
});

test.after(() => {
  server.close();
});

test('catalog filters + account + wishlist + prepaid payment flow + admin stats', async () => {
  const metaRes = await fetch(`${base}/api/catalog/meta`);
  assert.equal(metaRes.status, 200);

  const productsRes = await fetch(`${base}/api/products?category=Beds&material=Sheesham&sort=price_asc`);
  assert.equal(productsRes.status, 200);
  const productsData = await productsRes.json();
  assert.ok(productsData.products.length >= 1);

  const signupRes = await fetch(`${base}/api/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Tester', phone: '+919900001111', email: 'tester@tree.test', password: 'pass1234'
    })
  });
  assert.equal(signupRes.status, 201);

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrPhone: 'tester@tree.test', password: 'pass1234' })
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${loginData.token}` };

  const addrRes = await fetch(`${base}/api/account/addresses`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      name: 'Tester', line1: 'Street 1', city: 'Jaipur', state: 'RJ', pincode: '302001', phone: '+919900001111'
    })
  });
  assert.equal(addrRes.status, 201);
  const addrData = await addrRes.json();

  const wishAddRes = await fetch(`${base}/api/account/wishlist/${productsData.products[0].id}`, {
    method: 'POST', headers: auth
  });
  assert.equal(wishAddRes.status, 200);

  const couponRes = await fetch(`${base}/api/coupons/validate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'TREE10', total: productsData.products[0].price })
  });
  assert.equal(couponRes.status, 200);

  const orderRes = await fetch(`${base}/api/orders`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      items: [{ productId: productsData.products[0].id, quantity: 1 }],
      addressId: addrData.address.id,
      couponCode: 'TREE10',
      paymentMode: 'UPI'
    })
  });
  assert.equal(orderRes.status, 201);
  const orderData = await orderRes.json();

  const payInitRes = await fetch(`${base}/api/payment/initiate`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ orderId: orderData.order.id, gateway: 'Razorpay', mode: 'UPI', upiId: 'tree@upi' })
  });
  assert.equal(payInitRes.status, 200);
  const payInitData = await payInitRes.json();

  const payVerifyRes = await fetch(`${base}/api/payment/verify-otp`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ paymentSessionId: payInitData.paymentSessionId, otp: payInitData.demoOtp })
  });
  assert.equal(payVerifyRes.status, 200);
  const payVerifyData = await payVerifyRes.json();
  assert.equal(payVerifyData.order.status, 'PAID');

  const trackRes = await fetch(`${base}/api/tracking/${payVerifyData.order.trackingId}`, { headers: auth });
  assert.equal(trackRes.status, 200);

  const adminRes = await fetch(`${base}/api/admin/dashboard`, { headers: { 'x-admin-key': 'treewalley-admin-key' } });
  assert.equal(adminRes.status, 200);
  const adminData = await adminRes.json();
  assert.ok(adminData.ordersCount >= 1);
});
