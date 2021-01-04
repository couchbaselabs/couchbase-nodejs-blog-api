const couchbase = require('couchbase')
const express = require('express')
const uuid = require('uuid')
const bodyParser = require('body-parser')
const bcrypt = require('bcryptjs')

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

const cluster = new couchbase.Cluster('couchbase://localhost', {
  username: 'Administrator', password: 'password'
})
const bucket = cluster.bucket('blog')
const collection = bucket.defaultCollection()

// validation middleware
const validate = async(request, response, next) => {
  const authHeader = request.headers["authorization"]
  if (authHeader) {
    bearerToken = authHeader.split(" ")
    if (bearerToken.length == 2) {
      await collection.get(bearerToken[1])
        .then(async(result) => {
          request.pid = result.value.pid
          await collection.touch(bearerToken[1], 3600)
            .then(() => next())
            .catch((e) => console.error(e.message))
        })
        .catch((e) => response.status(401).send({ "message": "Invalid session token" }))
    }
  } else {
    response.status(401).send({ "message": "An authorization header is required" })
  }
}

// create account endpoint
app.post("/account", async (request, response) => {
  if (!request.body.email) {
    return response.status(401).send({ "message": "An `email` is required" })
  } else if (!request.body.password) {
    return response.status(401).send({ "message": "A `password` is required" })
  }

  const id = uuid.v4()
  const account = {
    "type": "account",
    "pid": id,
    "email": request.body.email,
    "password": bcrypt.hashSync(request.body.password, 10)
  }
  const profile = {
    "type": "profile",
    "email": request.body.email
  }

  await collection.insert(id, profile)
    .then(async () => {
      await collection.insert(request.body.email, account)
        .then((result) => response.send(result))
        .catch(async (e) => {
          await collection.remove(id)
            .then(() => {
              console.error(`account creation failed, removed: ${id}`)
              return response.status(500).send(e)
            })
            .catch(e => response.status(500).send(e))
        })
    })
    .catch(e => response.status(500).send(e))
})

// login user endpoint
app.post("/login", async (request, response) => {
  if (!request.body.email) {
    return response.status(401).send({ "message": "An `email` is required" })
  } else if (!request.body.password) {
    return response.status(401).send({ "message": "A `password` is required" })
  }

  await collection.get(request.body.email)
    .then(async (result) => {
      if (!bcrypt.compareSync(request.body.password, result.value.password)) {
        return response.status(500).send({ "message": "Password invalid" })
      }
      var session = {
        "type": "session",
        "id": uuid.v4(),
        "pid": result.value.pid
      }
      await collection.insert(session.id, session, { "expiry": 3600 })
        .then(() => response.send({ "sid": session.id }))
        .catch(e => response.status(500).send(e))
    })
    .catch(e => response.status(500).send(e))
})

// validate account endpoint
app.get("/account", validate, async (request, response) => {
  try {
    await collection.get(request.pid)
      .then((result) => response.send(result.value))
      .catch((e) => response.status(500).send(e))
  } catch (e) {
    console.error(e.message)
  }
})

// create blog endpoint
app.post("/blog", validate, async(request, response) => {
  if(!request.body.title) {
    return response.status(401).send({ "message": "A `title` is required" })
  } else if(!request.body.content) {
    return response.status(401).send({ "message": "A `content` is required" })
  }
  var blog = {
    "type": "blog",
    "pid": request.pid,
    "title": request.body.title,
    "content": request.body.content,
    "timestamp": (new Date()).getTime()
  }
  const uniqueId = uuid.v4()
  collection.insert(uniqueId, blog)
    .then(() => response.send(blog))
    .catch((e) => response.status(500).send(e))
})

// get blog posts endpoint
app.get("/blogs", validate, async(request, response) => {
  try {
    const query = `SELECT * FROM \`blog\` WHERE type = 'blog' AND pid = $PID;`
    const options = { parameters: { PID: request.pid } }
    await cluster.query(query, options)
      .then((result) => response.send(result.rows))
      .catch((e) => response.status(500).send(e))
  } catch (e) {
    console.error(e.message)
  }
})

// get profile endpoint (bonus example, not covered in tutorial)
app.get("/profile/:pid", async(request, response) => {
  try {
    const result = await collection.get(request.params.pid)
    response.send(result)
  } catch (e) {
    return response.status(500).send(e.message)
  }
})

const server = app.listen(3000, () => console.info(`Running on port ${server.address().port}...`))