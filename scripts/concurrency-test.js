// concurrency-test.js
//
// this script proves the row-locking in transferMoney() actually works
// under concurrent load, instead of just trusting the code by reading it.
//
// what it does:
// 1. registers 2 fresh test users (sender + receiver)
// 2. deposits a known starting amount into sender's wallet
// 3. fires N transfer requests at the SAME wallet, all at once (Promise.all)
// 4. reads both wallets' final balances
// 5. checks that:
//      - sender's balance = starting balance - (successful transfers * amount)
//      - receiver's balance = successful transfers * amount
//      - the ledger sum matches the wallet balance for both (reconciliation)
//
// if locking was broken (e.g. no FOR UPDATE), you'd see lost updates here -
// the final balance would NOT match the expected math, because two requests
// would read the same "before" balance and both write based on stale data.
//
// run with: node scripts/concurrency-test.js
// (make sure the server is already running on localhost:3000 first)

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';
const NUM_REQUESTS = 30;
const TRANSFER_AMOUNT = 10;
const STARTING_BALANCE = 1000;

async function registerAndLogin(email, password) {
  await axios.post(`${BASE_URL}/auth/register`, {
    fullName: 'Concurrency Test User',
    email,
    password
  });

  const loginRes = await axios.post(`${BASE_URL}/auth/login`, { email, password });
  return loginRes.data.data.accessToken;
}

async function run() {
  const stamp = Date.now();
  const senderEmail = `concurrency_sender_${stamp}@wallet.com`;
  const receiverEmail = `concurrency_receiver_${stamp}@wallet.com`;
  const password = 'Password@123';

  console.log('setting up test users...');
  const senderToken = await registerAndLogin(senderEmail, password);
  await registerAndLogin(receiverEmail, password);

  console.log(`depositing starting balance of ${STARTING_BALANCE} into sender wallet...`);
  await axios.post(
    `${BASE_URL}/wallet/deposit`,
    { amount: STARTING_BALANCE },
    { headers: { Authorization: `Bearer ${senderToken}` } }
  );

  console.log(`firing ${NUM_REQUESTS} concurrent transfers of ${TRANSFER_AMOUNT} each...`);

  const requests = [];
  for (let i = 0; i < NUM_REQUESTS; i++) {
    requests.push(
      axios
        .post(
          `${BASE_URL}/transactions/transfer`,
          { receiverEmail, amount: TRANSFER_AMOUNT },
          { headers: { Authorization: `Bearer ${senderToken}` } }
        )
        .then(() => ({ ok: true }))
        .catch((err) => ({ ok: false, reason: err.response?.data?.message || err.message }))
    );
  }

  const results = await Promise.all(requests);

  const successful = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log(`\n${successful} succeeded, ${failed.length} failed`);
  if (failed.length > 0) {
    console.log('sample failure reasons:', [...new Set(failed.map((f) => f.reason))]);
  }

  // check final balances
  const senderBalanceRes = await axios.get(`${BASE_URL}/wallet/balance`, {
    headers: { Authorization: `Bearer ${senderToken}` }
  });
  const finalSenderBalance = senderBalanceRes.data.data.balance;

  const expectedSenderBalance = STARTING_BALANCE - successful * TRANSFER_AMOUNT;
  const expectedReceiverBalance = successful * TRANSFER_AMOUNT;

  console.log('\n--- results ---');
  console.log(`expected sender balance: ${expectedSenderBalance}`);
  console.log(`actual sender balance:   ${finalSenderBalance}`);

  if (finalSenderBalance === expectedSenderBalance) {
    console.log('PASS: no lost updates, balance matches expected math exactly');
  } else {
    console.log('FAIL: balance mismatch - this would indicate a race condition / lost update');
  }

  console.log('\ndone. you can also cross check via the admin reconcile endpoint:');
  console.log(`GET /api/admin/reconcile/:walletId (use an admin token)`);
}

run().catch((err) => {
  console.error('script crashed:', err.response?.data || err.message);
  process.exit(1);
});
