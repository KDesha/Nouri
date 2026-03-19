import request from "supertest";
import { pool } from "./src/database";
import { app } from "./src/index";

function randUser() {
  const suffix = Math.random().toString(16).slice(2);
  return {
    username: `test_${suffix}`,
    password: `Passw0rd_${suffix}`, // >= 6 chars
    name: "Test User",
  };
}

describe("Auth API", () => {
  afterAll(async () => {
    // close DB pool so Jest exits cleanly
    await pool.end();
  });

  test("Signup creates a user (200) then Login works (200)", async () => {
    const u = randUser();

    const signup = await request(app)
      .post("/auth/signup")
      .send({ username: u.username, password: u.password, name: u.name });

    expect(signup.status).toBe(200);
    expect(signup.body).toHaveProperty("id");
    expect(signup.body.username).toBe(u.username);

    const login = await request(app)
      .post("/auth/login")
      .send({ username: u.username, password: u.password });

    expect(login.status).toBe(200);
    expect(login.body).toHaveProperty("id");
    expect(login.body.username).toBe(u.username);

    // cleanup (optional but nice)
    await pool.query(`DELETE FROM users WHERE username = $1`, [u.username]);
  });

  test("Login fails with wrong password (401)", async () => {
    const u = randUser();

    await request(app)
      .post("/auth/signup")
      .send({ username: u.username, password: u.password, name: u.name });

    const badLogin = await request(app)
      .post("/auth/login")
      .send({ username: u.username, password: "wrongpassword" });

    expect(badLogin.status).toBe(401);

    await pool.query(`DELETE FROM users WHERE username = $1`, [u.username]);
  });

  test("Signup rejects invalid username (400)", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({ username: "bad username!", password: "123456", name: "Test" });

    expect(res.status).toBe(400);
  });

  test("Signup rejects short password (400)", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({ username: "valid_user_1", password: "123", name: "Test" });

    expect(res.status).toBe(400);
  });

  test("Signup rejects duplicate username (409)", async () => {
    const u = randUser();

    const first = await request(app)
      .post("/auth/signup")
      .send({ username: u.username, password: u.password, name: u.name });

    expect(first.status).toBe(200);

    const dup = await request(app)
      .post("/auth/signup")
      .send({ username: u.username, password: u.password, name: u.name });

    expect(dup.status).toBe(409);

    await pool.query(`DELETE FROM users WHERE username = $1`, [u.username]);
  });
});