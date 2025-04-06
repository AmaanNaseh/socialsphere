let currentUser = null;

// On page load, check if the user is logged in
window.onload = () => {
  const storedUser = localStorage.getItem("currentUser");
  document.getElementById("loginToggle").style.display = "none";

  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    document.getElementById(
      "username"
    ).textContent = `Welcome, ${currentUser.username}`;
    document.getElementById("mainSection").style.display = "flex";
    document.getElementById("logoutButton").style.display = "block";
    document.getElementById("loginForm").style.display = "none";
    document.getElementById("signupForm").style.display = "none";
    fetchPosts();
    fetchUsers();
    fetchAllUsers();
    fetchAllUsersForFollow();
  } else {
    document.getElementById("loginForm").style.display = "block";
    document.getElementById("signupForm").style.display = "block";
  }
};

// Login function
async function login() {
  const email = document.getElementById("loginEmailInput").value;
  const password = document.getElementById("loginPasswordInput").value;

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const user = await res.json();
  if (user.error) {
    alert(user.error);
    return;
  }

  currentUser = user;
  localStorage.setItem("currentUser", JSON.stringify(user));
  document.getElementById("username").textContent = `Welcome, ${user.username}`;
  fetchPosts(); // Load posts after login
  fetchUsers(); // Load users after login
  fetchAllUsers();
  fetchAllUsersForFollow();
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("logoutButton").style.display = "block";
  document.getElementById("mainSection").style.display = "flex";
}

// Logout function
function logout() {
  localStorage.removeItem("currentUser");
  currentUser = null;
  document.getElementById("username").textContent = "";
  document.getElementById("logoutButton").style.display = "none";
  document.getElementById("loginForm").style.display = "block";
  document.getElementById("signupForm").style.display = "block";

  // Reload the page
  location.reload();
}

// Signup function
async function signup() {
  const username = document.getElementById("signupUsernameInput").value;
  const password = document.getElementById("signupPasswordInput").value;
  const email = document.getElementById("signupEmailInput").value;

  const res = await fetch("/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email }),
  });

  const newUser = await res.json();
  alert("Signup successful!");
}

// Create a new post
async function createPost() {
  const content = document.getElementById("postContent").value;
  if (!content || !currentUser) return;

  const res = await fetch("/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, userId: currentUser._id }),
  });

  const post = await res.json();
  fetchPosts(); // Update posts after creating a new one
}

// Fetch all posts
async function fetchPosts() {
  const res = await fetch("/posts");
  const posts = await res.json();

  const postList = document.getElementById("postList");
  postList.innerHTML = "";
  posts.forEach((post) => {
    const postDiv = document.createElement("div");
    postDiv.className = "post";
    postDiv.textContent = `${post.content} - Posted by ${post.user.username}`;
    postList.appendChild(postDiv);
  });
}

// Fetch all users and display in two sections (Chat List + Follow Section)
async function fetchUsers() {
  const res = await fetch("/users");
  const users = await res.json();

  const userList = document.getElementById("userList"); // Chat user list

  userList.innerHTML = ""; // For chat users

  users.forEach((user) => {
    // Chat User List (same as before)
    const chatUserDiv = document.createElement("div");
    chatUserDiv.className = "user";
    chatUserDiv.textContent = user.username;
    chatUserDiv.onclick = () => startChat(user._id);
    userList.appendChild(chatUserDiv);
  });
}

async function fetchAllUsers() {
  const res = await fetch("/users");
  const users = await res.json();
  const allUsersList = document.getElementById("allUsersList"); // Follow section
  allUsersList.innerHTML = ""; // For follow buttons
  users.forEach((user) => {
    // Follow Section
    const userDiv = document.createElement("div");
    userDiv.className = "user";
    userDiv.innerHTML = `${user.username} 
            <button class="follow-btn" data-id="${user._id}">
                ${
                  user.followersCount.includes(currentUser._id)
                    ? "Unfollow"
                    : "Follow"
                }
            </button>`;

    // Add event listener to follow/unfollow button
    const followButton = userDiv.querySelector(".follow-btn");
    followButton.addEventListener("click", async () => {
      await toggleFollow(user._id, followButton);
    });

    allUsersList.appendChild(userDiv);
  });
}

// Fetch users for the follow/unfollow section (Separate function)
async function fetchAllUsersForFollow() {
  const res = await fetch("/users");
  const users = await res.json();

  const allUsersList = document.getElementById("allUsersList"); // Follow section
  allUsersList.innerHTML = ""; // Clear follow list

  users.forEach((user) => {
    const userDiv = document.createElement("div");
    userDiv.className = "user";
    userDiv.innerHTML = `
            <span>${user.username}</span> 
           <button class="follow-btn" data-id="${user._id}">
            ${
              user.followersCount.includes(currentUser._id)
                ? "Unfollow"
                : "Follow"
            }
           </button>
            <span class="stats">
                Followers: <span class="follower-count">${
                  user.followersCount.length
                }</span> | 
                Following: <span class="following-count">${
                  user.followingCount.length
                }</span>
            </span>
        `;

    // Add event listener to follow/unfollow button
    const followButton = userDiv.querySelector(".follow-btn");
    followButton.addEventListener("click", async () => {
      await toggleFollow(user._id, followButton, userDiv);
    });

    allUsersList.appendChild(userDiv);
  });
}

// Toggle Follow/Unfollow & Update Counts
async function toggleFollow(targetUserId, button, userDiv) {
  if (!currentUser) {
    alert("You must be logged in to follow users.");
    return;
  }

  const res = await fetch("/users/follow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: currentUser._id, targetUserId }),
  });

  const data = await res.json();
  if (data.error) {
    alert(data.error);
  } else {
    // Toggle button text
    button.textContent =
      button.textContent === "Follow" ? "Unfollow" : "Follow";

    // Update follower & following count dynamically
    const followerCount = userDiv.querySelector(".follower-count");
    const followingCount = userDiv.querySelector(".following-count");

    // If the current user followed, increase count, otherwise decrease
    if (button.textContent === "Unfollow") {
      followerCount.textContent = parseInt(followerCount.textContent) + 1;
    } else {
      followerCount.textContent = parseInt(followerCount.textContent) - 1;
    }

    // Refresh follow list after update
    fetchAllUsersForFollow();
  }
}

// Notification
// Fetch and display notifications with time formatting
async function fetchNotifications() {
  if (!currentUser) return;

  const res = await fetch(`/notifications/${currentUser._id}`);
  const notifications = await res.json();

  const notificationList = document.getElementById("notificationList");
  notificationList.innerHTML = ""; // Clear previous notifications

  notifications.forEach((notification) => {
    const div = document.createElement("div");
    div.className = "notification";
    div.textContent = `${notification.content} - ${timeAgo(
      notification.createdAt
    )}`;
    notificationList.appendChild(div);
  });
}

// Function to format time as "x minutes/hours/days ago"
function timeAgo(timestamp) {
  const createdAt = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now - createdAt) / 1000);

  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

// Clear notifications
async function clearNotifications() {
  if (!currentUser) return;

  await fetch(`/notifications/${currentUser._id}`, { method: "DELETE" });
  fetchNotifications();
}

// Fetch notifications on page load
setInterval(fetchNotifications, 5000); // Auto-refresh notifications every 5 seconds

// Start a chat
let currentChatUser = null;
async function startChat(userId) {
  currentChatUser = userId;
  const res = await fetch(`/chat/${currentUser._id}/${userId}`);
  const messages = await res.json();

  const messageList = document.getElementById("messages");
  messageList.innerHTML = "";
  messages.forEach((message) => {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message";
    messageDiv.textContent = `${message.sender.username}: ${message.message}`;
    messageList.appendChild(messageDiv);
  });
}

// Send a message in chat
async function sendMessage() {
  const message = document.getElementById("messageText").value;
  if (!message || !currentChatUser) return;

  const res = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      senderId: currentUser._id,
      receiverId: currentChatUser,
      message,
    }),
  });

  const messages = await res.json();
  const messageList = document.getElementById("messages");
  messageList.innerHTML = "";
  messages.forEach((message) => {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message";
    messageDiv.textContent = `${message.sender.username}: ${message.message}`;
    messageList.appendChild(messageDiv);
  });
}

// Function to toggle visibility of Signup/Login forms
var formToShow = "signup";
function toggleForms(formToShow) {
  const signupForm = document.getElementById("signupToggle");
  const loginForm = document.getElementById("loginToggle");

  if (formToShow === "signup") {
    signupForm.style.display = "block";
    loginForm.style.display = "none";
  } else {
    loginForm.style.display = "block";
    signupForm.style.display = "none";
  }
}
