// js/auth.js

async function signUp(email, password) {
  const { data, error } = await db.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  const { error } = await db.auth.signOut();
  if (error) throw error;
  window.location.href = 'index.html';
}

async function getUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

// Redirect to app if already logged in (on login page)
async function requireGuest() {
  const user = await getUser();
  if (user) window.location.href = 'app.html';
}

// Redirect to login if not logged in (on app page)
async function requireAuth() {
  const user = await getUser();
  if (!user) window.location.href = 'index.html';
  return user;
}
