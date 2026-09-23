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
    expect(signup.body).toHaveProperty("token");
    expect(signup.body.username).toBe(u.username);

    const login = await request(app)
      .post("/auth/login")
      .send({ username: u.username, password: u.password });

    expect(login.status).toBe(200);
    expect(login.body).toHaveProperty("id");
    expect(login.body).toHaveProperty("token");
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

  test("A logged-in user can permanently delete their account", async () => {
    const u = randUser();
    const signup = await request(app)
      .post("/auth/signup")
      .send({ username: u.username, password: u.password, name: u.name });

    const deleted = await request(app)
      .delete("/user/account")
      .set("Authorization", `Bearer ${signup.body.token}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.ok).toBe(true);

    const login = await request(app)
      .post("/auth/login")
      .send({ username: u.username, password: u.password });
    expect(login.status).toBe(401);
  });

  test("A logged-in user can save health priorities and care-team notes", async () => {
    const u = randUser();
    const signup = await request(app)
      .post("/auth/signup")
      .send({ username: u.username, password: u.password, name: u.name });

    const saved = await request(app)
      .post("/user/conditions")
      .set("Authorization", `Bearer ${signup.body.token}`)
      .send({
        conditions: ["IBS", "KidneyDisease"],
        settings: {
          ibsMode: "reintroduction",
          kidneyStage: 3,
          kidneyLimitPotassium: true,
        },
        doctorRecommendations: "Follow my personalized sodium target.",
      });
    expect(saved.status).toBe(200);

    const loaded = await request(app)
      .get("/user/conditions")
      .set("Authorization", `Bearer ${signup.body.token}`);
    expect(loaded.status).toBe(200);
    expect(loaded.body.doctorRecommendations).toBe("Follow my personalized sodium target.");
    expect(loaded.body.conditions.map((item: any) => item.condition_id)).toEqual(
      expect.arrayContaining(["IBS", "KidneyDisease"])
    );

    await pool.query(`DELETE FROM users WHERE username = $1`, [u.username]);
  });
});
