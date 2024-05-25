const express = require("express");
const { open } = require("sqlite");
const cors = require("cors");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const DBPath = path.join(__dirname, "./users.db");
app.use(express.json());
app.use(cors());

let db;

const initilizationDBAndServer = async () => {
  try {
    db = await open({
      filename: DBPath,
      driver: sqlite3.Database,
    });
    app.listen(5000, () =>
      console.log(`server is running ${process.env.PORT}`)
    );
  } catch (e) {
    console.log(e.message);
  }
};

initilizationDBAndServer();

const verifyUserIdentity = async (request, response, next) => {
  if (request.headers["authorization"] === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    const JwtToken = request.headers["authorization"].split(" ")[1];
    if (JwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(JwtToken, "MY_SECRET_TOKEN", async (error, playload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.userId = playload.user_id;
          next();
        }
      });
    }
  }
};

app.post("/register", async (request, response) => {
  const { username, password } = request.body;

  const checkUserQuery = `
          select * from users_details where username = '${username}'
      `;
  const dbResponse = await db.get(checkUserQuery);
  if (dbResponse === undefined) {
    if (password.length > 5) {
      const modifyPassword = await bcrypt.hash(password, 10);
      const sqlQuery = `
                  insert into
                  users_details(username , password)
                  values ('${username}' , '${modifyPassword}')
              `;
      await db.run(sqlQuery);
      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const checkUserQuery = `
        select * from users_details where username = '${username}'
    `;
  const dbCheckResponse = await db.get(checkUserQuery);
  if (dbCheckResponse !== undefined) {
    const comparePassword = await bcrypt.compare(
      password,
      dbCheckResponse.password
    );
    if (comparePassword) {
      const playload = {
        user_id: dbCheckResponse.id,
      };
      const jwtToken = await jwt.sign(playload, "MY_SECRET_TOKEN");
      response.status(200);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

app.get("/user", verifyUserIdentity, async (req, resp) => {
  const query = `select *  from users_details where id = ${req.userId}`;
  const response = await db.get(query);
  resp.status(200);
  resp.send(response);
});
