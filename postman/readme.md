# Postman Collection, Environment and Variables for Blog API with User Profile

[This directory](https://github.com/couchbaselabs/couchbase-nodejs-blog-api/tree/master/postman) contains collection and environment variable files meant to be imported into postman to help you test your Blog API created from the tutorial: [Creating a User Profile Store with Node.js and a NoSQL Database](https://blog.couchbase.com/creating-user-profile-store-with-node-js-nosql-database/).

## Running These Postman Requests

Once you have Couchbase Server up and running with a bucket named `blog` and your index created in Couchbase and have run `node server` from the root of this project, you can import the following two files into Postman using the **Import** button near the top left of the Postman UI:

- [CouchbaseBlog_postman_environment.json](https://github.com/couchbaselabs/couchbase-nodejs-blog-api/blob/master/postman/CouchbaseBlog_postman_environment.json)
- [CouchbaseBlogAPI_postman_collection.json](https://github.com/couchbaselabs/couchbase-nodejs-blog-api/blob/master/postman/CouchbaseBlogAPI_postman_collection.json)

Once installed run the endpoints in the following order:

1. POST: `create account`  
   copy the **pid** returned from this endpoint and update the **current value** of the environment variable named **pid** in the **"Couchbase Blog"** environment.
2. GET: `get profile`  
   Not covered in the tutorial, but this endpoint is ready to fetch a profile by **pid**
3. POST: `login user`  
   copy the **sid** value returned from this endpoint and update the **current value** of the environment variable named **sid** in the **"Couchbase Blog"** environment.
4. GET: `validate account`  
5. POST: `create blog`  
   consider updating the postman **x-www-form-urlencodeed** form to create multiple blog posts.
6. GET: `get blog posts`

**NOTE**: These are for example purposes only and are not considered ready for production requests or code samples. This repository is supplied simply to ensure that you have a way to test your API from the blog post and to provide a completed version of the project built in the blog post.