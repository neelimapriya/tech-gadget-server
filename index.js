require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// ({ origin: ["http://localhost:5173"], credentials: true }

// const uri = `mongodb+srv://${process.env.TG_USER}:${process.env.TG_PASS}@cluster0.dtfuxds.mongodb.net/?retryWrites=true&w=majority`;

const uri = `mongodb+srv://${process.env.TG_USER}:${process.env.TG_PASS}@cluster0.dtfuxds.mongodb.net/?retryWrites=true&w=majority`;

// console.log(process.env.TG_PASS, process.env.TG_USER)

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const userCollection = client.db("TechGadgetDb").collection("users");
    const productCollection = client.db("TechGadgetDb").collection("products");
    const upvoteCollection = client.db("TechGadgetDb").collection("upvote");
    const downvoteCollection = client.db("TechGadgetDb").collection("downvote");

    // jwt api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "7h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // user collection
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({
          message: "This user is exist in the database",
          insertedId: null,
        });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // product api's
    app.get("/product", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.findOne(query);
      console.log({ result });
      res.send(result);
    });

    app.get("/featured", async (req, res) => {
      const result = await productCollection
        .find({ type: "featured" })
        .toArray();
      console.log({ result });
      res.send(result);
    });

    app.get("/trending", async (req, res) => {
      const result = await productCollection
        .find({ type: "trending" })
        .toArray();
      console.log({ result });
      res.send(result);
    });


    // upvote api
    app.post("/upvote", async (req, res) => {
        const item = req.body;
        const result = await upvoteCollection.insertOne(item);
        res.send(result);
      });
      app.get("/upvoteCount", async (req, res) => {
        const result = await upvoteCollection.find().toArray();
        res.send(result);
      });
      

    // downvote api
    app.post("/down", async (req, res) => {
        const item = req.body;
        const result = await downvoteCollection.insertOne(item);
        res.send(result);
      });

      app.get("/downvoteCount", async (req, res) => {
        const result = await downvoteCollection.find().toArray();
        res.send(result);
      });



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("tech gadget server is running");
});
app.listen(port, () => {
  console.log(`tech server running on ${port}`);
});
