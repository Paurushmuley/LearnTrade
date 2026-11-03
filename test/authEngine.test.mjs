import test from 'node:test';
import assert from 'node:assert/strict';

function hashPassword(password) {
  let hash = 0;
  const salt = 'tradecraft_ai_sebi_salt_2026';
  const combined = password + salt;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16) + 'sec';
}

const DEMO_ACCOUNTS = [
  {
    id: 'user_arjun_scalper',
    email: 'arjun.trader@tradecraft.ai',
    name: 'Arjun Mehta',
    persona: 'INTRADAY_SCALPER',
    passwordHash: hashPassword('Demo@123'),
  },
  {
    id: 'user_priya_quant',
    email: 'priya.quant@tradecraft.ai',
    name: 'Priya Sharma',
    persona: 'OPTIONS_QUANT',
    passwordHash: hashPassword('Demo@123'),
  },
  {
    id: 'user_rohit_novice',
    email: 'rohit.novice@tradecraft.ai',
    name: 'Rohit Verma',
    persona: 'MARKET_BEGINNER',
    passwordHash: hashPassword('Demo@123'),
  },
];

function mockAuthStore() {
  const accounts = [...DEMO_ACCOUNTS];

  return {
    login(email, pass) {
      const acc = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());
      if (!acc) return { success: false, error: 'User not found' };
      if (acc.passwordHash !== hashPassword(pass)) return { success: false, error: 'Invalid password' };
      return { success: true, user: acc };
    },
    register(name, email, pass, persona = 'INTRADAY_SCALPER') {
      if (!name || !email || pass.length < 6) return { success: false, error: 'Validation failed' };
      if (accounts.some(a => a.email.toLowerCase() === email.toLowerCase())) {
        return { success: false, error: 'Email already exists' };
      }
      const newAcc = { id: `user_${Date.now()}`, email, name, persona, passwordHash: hashPassword(pass) };
      accounts.push(newAcc);
      return { success: true, user: newAcc };
    },
    requestReset(email) {
      const acc = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());
      if (!acc) return { success: false, error: 'Not found' };
      acc.resetToken = '884422';
      return { success: true, token: acc.resetToken };
    },
    resetPassword(email, token, newPass) {
      const acc = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());
      if (!acc || acc.resetToken !== token) return { success: false, error: 'Invalid token' };
      if (newPass.length < 6) return { success: false, error: 'Short password' };
      acc.passwordHash = hashPassword(newPass);
      delete acc.resetToken;
      return { success: true };
    }
  };
}

test('Password Hashing - Deterministic and Salted', () => {
  const hash1 = hashPassword('Demo@123');
  const hash2 = hashPassword('Demo@123');
  const hashDiff = hashPassword('OtherPass');
  assert.equal(hash1, hash2, 'Identical passwords must produce identical hash');
  assert.notEqual(hash1, hashDiff, 'Different passwords must produce distinct hash');
  assert.ok(hash1.endsWith('sec'));
});

test('Auth Store - Demo Accounts Login', () => {
  const store = mockAuthStore();
  const resArjun = store.login('arjun.trader@tradecraft.ai', 'Demo@123');
  assert.equal(resArjun.success, true);
  assert.equal(resArjun.user.name, 'Arjun Mehta');

  const resBadPass = store.login('arjun.trader@tradecraft.ai', 'WrongPass');
  assert.equal(resBadPass.success, false);

  const resUnknown = store.login('unknown@tradecraft.ai', 'Demo@123');
  assert.equal(resUnknown.success, false);
});

test('Auth Store - Registration and Duplicate Prevention', () => {
  const store = mockAuthStore();
  const resReg = store.register('Karan Johar', 'karan@tradecraft.ai', 'SecurePass99');
  assert.equal(resReg.success, true);
  assert.equal(resReg.user.name, 'Karan Johar');

  // Attempt duplicate
  const resDup = store.register('Karan Clone', 'karan@tradecraft.ai', 'AnotherPass');
  assert.equal(resDup.success, false);
  assert.equal(resDup.error, 'Email already exists');
});

test('Auth Store - Forgot Password and Token Reset Flow', () => {
  const store = mockAuthStore();
  const resetReq = store.requestReset('priya.quant@tradecraft.ai');
  assert.equal(resetReq.success, true);
  assert.equal(resetReq.token, '884422');

  // Reset with wrong token
  const wrongToken = store.resetPassword('priya.quant@tradecraft.ai', '000000', 'NewSecret123');
  assert.equal(wrongToken.success, false);

  // Reset with correct token
  const correctReset = store.resetPassword('priya.quant@tradecraft.ai', '884422', 'NewSecret123');
  assert.equal(correctReset.success, true);

  // Verify login works with new password
  const newLogin = store.login('priya.quant@tradecraft.ai', 'NewSecret123');
  assert.equal(newLogin.success, true);
});
