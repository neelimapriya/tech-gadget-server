require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_API_KEY);

//
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

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
    const userCollection = client.db("TechGadgetDb").collection("users");
    const productCollection = client.db("TechGadgetDb").collection("products");
    // const upvoteCollection = client.db("TechGadgetDb").collection("upvote");
    // const downvoteCollection = client.db("TechGadgetDb").collection("downvote");
    const reviewCollection = client.db("TechGadgetDb").collection("review");
    const queueCollection = client.db("TechGadgetDb").collection("queue");
    const paymentCollection = client.db("TechGadgetDb").collection("payments");
    const couponCollection = client.db("TechGadgetDb").collection("coupon");

    //--------- jwt api--------
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "7h",
      });
      res.send({ token });
    });

    // --------middlewares----------
    const verifyToken = (req, res, next) => {
      // console.log("inside verify token", req.headers.authorization);
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

    // --------is admin api---------
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // --------is modaretor api---------
    const verifyModaretor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isModaretor = user?.role === "modaretor";
      if (!isModaretor) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // ---------user collection----------
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

    app.get("/getUser", verifyToken, async (req, res) => {
      console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // ------------------ADMIN------------------
    //-------- make admin api-------
    app.patch("/user/admin/:id",verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    // --------- get admin api-------
    app.get("/user/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // ------------MODARETOR--------------------
    // ---------make moderator api-------
    app.patch("/user/modaretor/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "modaretor",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    // -------get modaretor api---------
    app.get("/user/modaretor/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let modaretor = false;
      if (user) {
        modaretor = user?.role === "modaretor";
      }
      console.log(modaretor);
      res.send({ modaretor });
    });

    // ------delete user----------
    app.delete("/user/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    //-------- product api's-------------

    // -----post in QUEUE-------
    app.post("/addProduct", verifyToken, async (req, res) => {
      const item = req.body;
      const result = await queueCollection.insertOne(item);
      res.send(result);
    });

    // ----delete from queue when accepted----
    app.delete(
      "/deleteQueue/:id",
      verifyToken,
      verifyModaretor,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await queueCollection.deleteOne(query);
        res.send(result);
      }
    );

    // -----accepted product from QUEUE post in all products-------
    app.post(
      "/acceptProduct",
      verifyToken,
      verifyModaretor,
      async (req, res) => {
        const item = req.body;
        const result = await productCollection.insertOne(item);
        res.send(result);
      }
    );

    // --------make featured products(modaretor)-----
    app.patch(
      "/featured/:id",
      verifyToken,
      verifyModaretor,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            type: "featured",
          },
        };
        const result = await queueCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // ----get posted product from queue---------
    app.get("/getQueue", verifyToken, verifyModaretor, async (req, res) => {
      const result = await queueCollection.find().toArray();
      res.send(result);
    });
    app.get("/getQueue/:id", verifyToken, verifyModaretor, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await queueCollection.findOne(query);
      // console.log({ result }, 'queue');
      res.send(result);
    });

    // -----get all products--------
    app.get("/product", async (req, res) => {
      const filter = req.query;
      console.log(filter);
      const query = {
        tag: { $regex: filter.search, $options: "i" },
      };
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const result = await productCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();
        console.log(result,"pagination")
      res.send(result);
      
    });

    // --------pagination count--------
    app.get("/productCount", async (req, res) => {
      const number = await productCollection.estimatedDocumentCount();
      res.send({ number });
    });

    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.findOne(query);
      console.log({ result });
      res.send(result);
    });

    // for upvote
    app.patch("/upvote/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id, "id");
      const filter = {
        _id: new ObjectId(id),
      };
      console.log(req.body.vote, "vote");

      const updateInfo = {
        $set: {
          vote: req.body.vote,
        },
      };

      const result = await productCollection.updateOne(filter, updateInfo);
      console.log(result);
      res.send(result);
    });
    // for downVote
    app.patch("/downVote/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id, "id");
      const filter = {
        _id: new ObjectId(id),
      };
      console.log(req.body.downVote, "downVote");

      const updateInfo = {
        $set: {
          downVote: req.body.downVote,
        },
      };

      const result = await productCollection.updateOne(filter, updateInfo);
      console.log(result);
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

    // ---------report product api---------
    app.patch("/report/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "reported",
        },
      };
      const result = await productCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    // ----get reported products----------
    app.get("/reported", verifyToken, verifyModaretor, async (req, res) => {
      const result = await productCollection
        .find({ status: "reported" })
        .toArray();
      console.log({ result });
      res.send(result);
    });

    // get user products
    app.get("/userProducts", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await productCollection.find(query).toArray();
      res.send(result);
    });

    // --------user products update--------
    app.patch("/userProducts/:id", verifyToken, async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          link: item.link,
          tag: item.tag,
          details: item.details,
          image: item.image,
        },
      };
      const result = await productCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/deleteProduct/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.deleteOne(query);
      res.send(result);
    });

    //------------ review---------
    app.post("/review", verifyToken, async (req, res) => {
      const item = req.body;
      const result = await reviewCollection.insertOne(item);
      res.send(result);
    });
    app.get("/reviewItem/:Id", async (req, res) => {
      const Id = decodeURIComponent(req.params.Id);
      console.log(Id);
      const query = { ProductId: Id };
      console.log(query);
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });

    // --------------PAYMENT----------
    // from stripe payment docs
    app.post("/create-payment-intent", async (req, res) => {
      const { money } = req.body;
      const amount = parseInt(money * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // -----post payment info indatabase------
    app.post("/payments", verifyToken, async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      res.send(paymentResult);
    });

    app.get("/verified", verifyToken, async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    // coupon
    app.get("/coupons", verifyToken, async (req, res) => {
      const result = await couponCollection.find().toArray();
      res.send(result);
    });

    app.get("/coupon/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await couponCollection.findOne(query);
      console.log({ result });
      res.send(result);
    });
    app.patch("/updateCoupon/:id", verifyToken, async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          Amount: item.Amount,
          Code: item.Code,
          description: item.description,
        },
      };
      const result = await couponCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //------ statistic page api-----
    app.get('/stats',async(req,res)=>{
      const productCount=await productCollection.countDocuments()
      const reviewsCount =await reviewCollection.countDocuments()
      const usersCount =await userCollection.countDocuments()
      const data =[
        { name: 'Products', value: productCount },
        { name: 'Reviews', value: reviewsCount },
        { name: 'Users', value: usersCount },
      ]
      res.send(data)
    })




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
