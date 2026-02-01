import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verifyGoogleToken(token) {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload();
  } catch (error) {
    console.error('Google token verification failed:', error);
    throw new Error('Invalid Google token');
  }
}

export async function authenticateGoogle(googleToken) {
  const payload = await verifyGoogleToken(googleToken);
  
  const { sub: googleId, email, name, picture } = payload;

  // Check if user exists
  let result = await query(
    'SELECT * FROM users WHERE google_id = $1',
    [googleId]
  );

  let user;
  
  if (result.rows.length === 0) {
    // Create new user
    const username = email.split('@')[0] + Math.floor(Math.random() * 1000);
    
    result = await query(
      `INSERT INTO users (google_id, email, name, avatar_url, username, status)
       VALUES ($1, $2, $3, $4, $5, 'online')
       RETURNING *`,
      [googleId, email, name, picture, username]
    );
    
    user = result.rows[0];
    console.log('New user created:', user.id);
  } else {
    // Update existing user
    user = result.rows[0];
    await query(
      'UPDATE users SET status = $1, last_seen = NOW() WHERE id = $2',
      ['online', user.id]
    );
  }

  // Generate JWT
  const jwtToken = jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      name: user.name 
    },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  return { user, token: jwtToken };
}

export function verifyJWT(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export async function refreshUserSession(userId) {
  await query(
    'UPDATE users SET last_seen = NOW(), status = $1 WHERE id = $2',
    ['online', userId]
  );
}
