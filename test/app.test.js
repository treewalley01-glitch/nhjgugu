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

test('full otp login + order + payment flow works', async () => {
  const productsRes = await fetch(`${base}/api/products`);
  assert.equal(productsRes.status, 200);
  const productsData = await productsRes.json();
  assert.ok(productsData.products.length > 0);

  const sendOtpRes = await fetch(`${base}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919999999999' })
  });
  assert.equal(sendOtpRes.status, 200);
  const sendOtpData = await sendOtpRes.json();

  const verifyOtpRes = await fetch(`${base}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: sendOtpData.sessionId, otp: sendOtpData.demoOtp })
  });
  assert.equal(verifyOtpRes.status, 200);
  const verifyOtpData = await verifyOtpRes.json();
  assert.ok(verifyOtpData.token);

  const orderRes = await fetch(`${base}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${verifyOtpData.token}`
    },
    body: JSON.stringify({
      items: [{ productId: productsData.products[0].id, quantity: 1 }],
      shippingAddress: {
        name: 'Test Buyer',
        address: 'Test Street',
        city: 'Mumbai',
        pincode: '400001'
      }
    })
  });
  assert.equal(orderRes.status, 201);
  const orderData = await orderRes.json();

  const paymentInitRes = await fetch(`${base}/api/payment/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${verifyOtpData.token}`
    },
    body: JSON.stringify({
      orderId: orderData.order.id,
      cardNumber: '4111111111111111',
      cardHolder: 'Test Buyer',
      expiry: '12/28',
      cvv: '123'
    })
  });
  assert.equal(paymentInitRes.status, 200);
  const paymentInitData = await paymentInitRes.json();

  const paymentVerifyRes = await fetch(`${base}/api/payment/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${verifyOtpData.token}`
    },
    body: JSON.stringify({
      paymentSessionId: paymentInitData.paymentSessionId,
      otp: paymentInitData.demoOtp
    })
  });

  assert.equal(paymentVerifyRes.status, 200);
  const paymentVerifyData = await paymentVerifyRes.json();
  assert.equal(paymentVerifyData.order.status, 'PAID');
});
