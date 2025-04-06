require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public"))); // Serve static files

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("Error connecting to MongoDB:", err));

// Models
const Post = mongoose.model(
  "Post",
  new mongoose.Schema({
    content: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: String,
      },
    ],
  })
);

const User = mongoose.model(
  "User",
  new mongoose.Schema({
    username: String,
    password: String,
    email: { type: String, unique: true },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  })
);

const Chat = mongoose.model(
  "Chat",
  new mongoose.Schema({
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    messages: [
      {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        message: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  })
);

const Notification = mongoose.model(
  "Notification",
  new mongoose.Schema({
    type: String, // "follow", "post", "message"
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Who triggered the notification
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Who should receive it
    content: String, // Message content
    createdAt: { type: Date, default: Date.now },
  })
);

// Routes

// Get all posts with user details
app.get("/posts", async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "username")
      .populate("likes", "username")
      .populate("comments.user", "username");
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new post
app.post("/posts", async (req, res) => {
  const { content, userId } = req.body;
  try {
    const post = new Post({ content, user: userId, likes: [], comments: [] });
    await post.save();
    const user = await User.findById(userId);
    const followers = await User.find({ _id: { $in: user.followers } });

    followers.forEach(async (follower) => {
      await new Notification({
        type: "post",
        sender: userId,
        receiver: follower._id,
        content: `${user.username} made a new post.`,
      }).save();
    });

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Like a post
app.put("/posts/like/:postId", async (req, res) => {
  const { userId } = req.body;
  try {
    const post = await Post.findById(req.params.postId);
    if (!post.likes.includes(userId)) {
      post.likes.push(userId);
      await post.save();
      res.json(post);
    } else {
      res.status(400).json({ error: "Already liked" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Comment on a post
app.post("/posts/comment/:postId", async (req, res) => {
  const { userId, text } = req.body;
  try {
    const post = await Post.findById(req.params.postId);
    post.comments.push({ user: userId, text });
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Follow or Unfollow a User
app.post("/users/follow", async (req, res) => {
  const { userId, targetUserId } = req.body;

  if (userId === targetUserId) {
    return res.status(400).json({ error: "You cannot follow yourself" });
  }

  try {
    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const isFollowing = user.following.includes(targetUserId);

    if (isFollowing) {
      user.following = user.following.filter(
        (id) => id.toString() !== targetUserId
      );
      targetUser.followers = targetUser.followers.filter(
        (id) => id.toString() !== userId
      );
    } else {
      user.following.push(targetUserId);
      targetUser.followers.push(userId);
    }

    await user.save();
    await targetUser.save();

    if (!isFollowing) {
      // If the user just followed
      await new Notification({
        type: "follow",
        sender: userId,
        receiver: targetUserId,
        content: `${user.username} followed you.`,
      }).save();
    }

    res.json({ message: isFollowing ? "Unfollowed" : "Followed", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users (including whether the current user follows them)
app.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("username followers following");
    res.json(
      users.map((user) => ({
        _id: user._id,
        username: user.username,
        followersCount: user.followers.map((f) => f.toString()), // Convert to array of strings for checking
        followingCount: user.following.map((f) => f.toString()),
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get chat messages between two users (with username instead of ID)
app.get("/chat/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;
  try {
    const chat = await Chat.findOne({
      users: { $all: [user1, user2] },
    }).populate("messages.sender", "username");

    res.json(chat ? chat.messages : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a message in chat
app.post("/chat", async (req, res) => {
  const { senderId, receiverId, message } = req.body;
  try {
    let chat = await Chat.findOne({
      users: { $all: [senderId, receiverId] },
    });

    if (!chat) {
      chat = new Chat({ users: [senderId, receiverId], messages: [] });
    }

    const sender = await User.findById(senderId);

    chat.messages.push({
      sender: senderId,
      message,
      senderUsername: sender.username,
    });

    await chat.save();

    await new Notification({
      type: "message",
      sender: senderId,
      receiver: receiverId,
      content: `${sender.username} messaged you.`,
    }).save();

    res.json(chat.messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Notification
// Get notifications for a user
app.get("/notifications/:userId", async (req, res) => {
  try {
    const notifications = await Notification.find({
      receiver: req.params.userId,
    })
      .populate("sender", "username")
      .sort({ createdAt: -1 });

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all notifications for a user
app.delete("/notifications/:userId", async (req, res) => {
  try {
    await Notification.deleteMany({ receiver: req.params.userId });
    res.json({ message: "Notifications cleared" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User Login by email
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email, password });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User Signup
app.post("/signup", async (req, res) => {
  const { username, password, email } = req.body;
  try {
    const user = new User({ username, password, email });
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Root route: Serve the index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
