# Basic Blog API with User Profile store and Session

We will be creating a user profile store and session for a blog API using Node, Couchbase's NodeJS SDK 3 and we'll review basic data modeling techniques for our document structure specific to working with a document database. 

Let’s define some rules around our very basic user profile store concept:

- Store account data like username and password in a `profile` document
- Pass sensitive user data with each user action request
- Use a session that expires after a set amount of time
- Stored `session` documents with an expiry limit

We can manage all of this with the following API endpoints:

- POST `/account` – Create a new user profile with account information
- POST `/login` – Validate account information
- GET `/account` – Get account information
- POST `/blog` – Create a new blog entry associated to a user
- GET `/blogs` – Get all blog entries for a particular user

These endpoints will be part of our Express based REST API.

## Setting up Couchbase Server (Document Database) Using Docker

If you already have COuchbase running you can [skip to the tutorial](#creating-the-api).

The following shell command will setup a Couchbase Docker container with the name: `cb` using the official Couchbase Docker image.

```shell
docker pull couchbase
docker run -d --name cb -p 8091-8096:8091-8096 -p 11210-11211:11210-11211 couchbase
```

With your databse running locally you can access it at localhost:8091, set up a one node cluster:

1. Set Cluster Name (`Blog Tutorial`)
2. Set Admin User (`Administrator`)
3. Set Password (`password`)
4. Accept Terms
5. Configure Disk, Memory, Services (Check Data, Query, and Index at minimum)

Once logged in create a new bucket.

1. Select Bucket Tab
2. Click "ADD BUCKET"
3. Name your bucket `blog`

## Creating the API

Let’s create a project directory for our Node.js app and install our dependencies.

```shell
  mkdir blog-api && cd blog-api && npm init -y && touch server.js /
  npm install couchbase express body-parser uuid bcryptjs cors nodemon --save && code .
```

This creates a working directory for our project and initializes a new Node project, create a `server.js` installs required dependencies and opens VS Code.

Our dependencies include the [Node.js SDK for Couchbase](https://docs.couchbase.com/nodejs-sdk/3.1/hello-world/start-using-sdk.html) and Express Framework and other utility libraries like `body-parser` to accept JSON data via POST requests, `uuid` for generating unique keys and `bcryptjs` to hash our passwords to deter malicious users, and `nodemon` a tool that helps develop node.js based applications by automatically restarting the node application when file changes.

Let’s bootstrap our application with a `server.js` file:

```javascript
const couchbase = require('couchbase')
const express = require('express')
const uuid = require('uuid')
const bodyParser = require('body-parser')
const bcrypt = require('bcryptjs')
const cors = require('cors')

const app = express()

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

const cluster = new couchbase.Cluster('couchbase://localhost', {
  username: 'Administrator', password: 'password'
})
const bucket = cluster.bucket('blog')
const collection = bucket.defaultCollection()

/* All Code Goes Here */

const server = app.listen(3000, () => console.info(`Running on port ${server.address().port}...`))
```

The above code requires our dependencies and initializes an Express app running on port 3000 against Couchbase Server using a bucket named `blog`.

## Our First Endpoint

Before we create the intended API code for our project, we should go over some basics in Express. Let's set up an endpoint that will utilize the Couchbase NodeJS SDK to do a basic [key-value get operation](https://docs.couchbase.com/nodejs-sdk/current/howtos/kv-operations.html).

The most efficient way to query a document database is to ask for one document by its key. No indexing is required, we simply supply the key and in return get our document back.

First we need to add a document to our `blog` bucket in Couchbase Server:

1. On the Bucket tab, click on the `blog` bucket's "document" link
2. In the upper right hand corner of the screen there is an "ADD DOCUMENT" button.
3. It will prompt you for the ID, enter: `1234` and click "Save"
4. Then it will ask for the JSON value:

```json
{
  "type": "profile",
  "email": "user1234@gmail.com"
}
```

With that document in place, let's create an endpoint with the sole purpose of getting a single document.

Add the following code to the project:

```javascript
app.get("/profile/:pid", async(request, response) => {
  try {
    const result = await collection.get(request.params.pid)
    response.send(result)
  } catch (e) {
    return response.status(500).send(e.message)
  }
})
```

The route for this endpointis `/profile/` and it accepts a request parameter `:pid`. Considering the document we just created we could call this endpoint from Postman using: `localhost:3000/profile/1234`.

In the Postman collections that are included in this repo, we will have a request named: `get profile`, we can use that to test that our new API endpoint works.

In the terminal run: `nodemon server`
In Postman run the `get profile` request using `localhost:3000/profile/1234`

*\** This was just for demonstration purposes and to get our feet wet, we can remove the document that we added to the database and the code we just added to our `server.js`.

## Saving a New User to the Profile Store

Our user profile can have any information describing a `user` like `address`, `phone`, and other social media info. It is never a good idea to store account credentials in the same document as our basic profile information. We’ll need a minimum of two documents for every user.

### Profile Document

Our Profile document will have a *key* that we will refer to in our related documents. This key is an auto-generated UUID: `b181551f-071a-4539-96a5-8a3fe8717faf`.

It's *value* will includes two properties: `email` and `type`. The `type` property is an important indicator that describes our document similar to how a table organizes records in a relational database.

```json
{
  "type": "profile",
  "email": "user1234@gmail.com"
}
```

### Account Document

The account document associated with our [profile](#profile-document) will have a key that is equal to our user’s email:
`user1234@gmail.com` and just as before, this document also will have a `type`, as well as a `pid` referring to the key of our [profile document](#profile-document) and a hashed `password`.

```json
{
  "type": "account",
  "pid": "b181551f-071a-4539-96a5-8a3fe8717faf",
  "email": "user1234@gmail.com",
  "password": "$2a$10$tZ23pbQ1sCX4BknkDIN6NekNo1p/Xo.Vfsttm.USwWYbLAAspeWsC"
}
```

Great, we have established a model for each document and a strategy for relating those documents without database constraints.

## An Endpoint for Account Creation

Add the following code to our `server.js` just above the last line of code which starts ourt server:

```javascript
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
        .then((result) => {
          result.pid = id
          return response.send(result)
        })
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
```

Let’s break this code down.

First, we check that both an `email` and `password` exist in the request.

Then we start buidling a local copy of the documents we want to persist to the database:

Rather than saving the password in the `account` object as plain text, we hash it with [Bcrypt](https://www.npmjs.com/package/bcrypt). For more info on password hashing, check out [this tutorial](https://blog.couchbase.com/hashing-passwords-stored-in-couchbase-server-with-nodejs/).

With the data ready, we can insert it into Couchbase.

Next, we start by inserting the `profile` document using `collection.insert` and passing it the `key: id` and `document: profile`.

From here we either have success or an error. If an error occurs we catch, return a status of `500` and send back the error.

Otherwise if we get a success, we try to insert the `account` document.

*\** We want both the *account* and *profile* documents to be created successfully, otherwise we need to roll it all back.

If an error occurs we catch, rollback the document creation by deleting the `prfile` document we just added, then return a status of `500` and send back the error.

Otherwise if we get a success, we insert the `account` document, use the `pid` from the result we get back from Couchbase and add that property to the response object and send that back as a response, this will be seen by the client as a `200ok` response and they will get back the following object:

```json
{
    "cas": "1614421293851803648",
    "token": "553:133005712768050:1:blog",
    "pid": "b181551f-071a-4539-96a5-8a3fe8717faf"
}
```

## Using Session Tokens for Sensitive Data

With the user *profile* and *account* created, the user can sign-in which will create a session document.

### Session Document

We want to log in and establish a *session* that will be stored in the database referencing our user *profile* by `pid`. This document will eventually expire. Upon expiration, this document will be automatically removed from the database. Any activity beyond that point will require a new login and session. We also have the ability to update the expiration time if we need to (we will cover this later in the tutorial).

The session model will look like the following:

```json
{
  "type": "session",
  "id": "ce0875cb-bd27-48eb-b561-beee33c9f405",
  "pid": "b181551f-071a-4539-96a5-8a3fe8717faf"
}
```

Just like the *account* document, *session* has a `pid` property that references our user's *profile*.

The code that makes this possible is in the *login* endpoint:

```javascript
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
```

After validating the incoming data we do an account lookup by email address. If data comes back for the email, we can compare the incoming password with the hashed password returned in the account lookup. Provided this succeeds, we can create a new session for the user.

For this document we set an expiration of one hour (3600 ms). If the expiration isn’t refreshed, the document will disappear. This is good because it forces the user to sign-in again and get a new session. This session token will be passed with every future request instead of the password.

## Managing a User Session with Tokens

We want to get information about our user profile as well as associate new things to the profile, we confirm authority through the session.

We can confirm the session is valid using some Express middleware. A Middleware function can be added to any Express endpoint. This validation is a simple function that will have access to our endpoint’s HTTP request:

```javascript
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
```

Here we are checking the request for an authorization header. If we have a valid bearer token with session id (sid), we can do a lookup. The session document has the `pid` in it. If the session lookup is successful, we save the `pid` in the request.

Next, we refresh the session expiration and move through the middleware and back to the endpoint. If the session doesn’t exist, no `pid` will be passed and the request will fail.

Now we can use our middleware to get information about our *profile* in our account endpoint:

```javascript
app.get("/account", validate, async (request, response) => {
  try {
    await collection.get(request.pid)
      .then((result) => response.send(result.value))
      .catch((e) => response.status(500).send(e))
  } catch (e) {
    console.error(e.message)
  }
})
```

Notice the `validate` happens first and then the rest of the request. The `request.pid` was established by the middleware and it will get us a particular profile document for that id.

### Blog Document

Next, we create an endpoint to add a blog article for the user:

```javascript
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
```

Assuming the middleware succeeded, we create a blog object with a specific `type` and `pid`. Then we can save it to the database.

### Get All Blogs by User's Profile ID

Querying for all blog posts by a particular user isn’t too much different:

```javascript
app.get("/blogs", validate, async(request, response) => {
  try {
    const query = `SELECT * FROM `blog` WHERE type = 'blog' AND pid = $PID;`
    const options = { parameters: { PID: request.pid } }
    await cluster.query(query, options)
      .then((result) => response.send(result.rows))
      .catch((e) => response.status(500).send(e))
  } catch (e) {
    console.error(e.message)
  }
})
```

Because we need to query by document property rather than document key, we’ll use a N1QL query to return all documents for that particular profile.

Before we can call this endpoint or run the N1QL statement, we need to create a secodnary index.

### An Intorduction to Secondary Indexes

A secondary index is an index on any key-value or document-key. This index can use any key within the document and the key can be of any type: scalar, object, or array. In our case we are going to index on the `type` and `pid`, these are simple scalar values.

This is a special kind of secondary index called a [Composite Secondary Index](https://docs.couchbase.com/server/current/learn/services-and-indexes/indexes/indexing-and-query-perf.html#composite-secondary-index) which want to use for performance reasons because we are querying on `type = 'blog' AND pid = $PID`.

If a query is referencing only the keys in the index, the query engine can simply *answer the query from the index scan result without having to fetch from the node(s)*.

If we access our Couchbase Server web console running locally on `localhost:8091`, we can click on the *Query* tab and execute this statement in the Query Editor:

```sql
CREATE INDEX `blogbyuser` ON `blog`(type, pid);
```

Since we will obtain all blog posts for a particular profile id, we’ll get better performance using this specific index rather than a general primary index. Primary Indexes are not recommended for production-level code.

## Conclusion

You just saw how to create a user profile store and session using Node.js and NoSQL.

As previously mentioned, the account documents could represent a form of login credentials where you could have a document for basic authentication (Facebook authentication, etc.) referring to the same profile document. Instead of using a UUID for the session, a JSON Web Token (JWT) or maybe something more secure could be used.

The finished code, Postman collections, and environment variables available in the [couchbaselabs / couchbase-nodejs-blog-api](https://github.com/couchbaselabs/couchbase-nodejs-blog-api/tree/master/postman) repo on GitHub.