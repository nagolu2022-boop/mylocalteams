const appVersion = "11";
const brandName = "My Local Teams";
const profileKey = "my_local_teams_profile";
const defaultContext = {
  country: "UK",
  city: "Sheffield",
  area: "City Centre",
  community: "Telugu people"
};

const communityTree = {
  UK: {
    Sheffield: {
      Darnall: ["Telugu people", "Tamil people", "Malayalam people", "Kannada people"],
      Hillsborough: ["Telugu people", "Tamil people", "Malayalam people"],
      "City Centre": ["Telugu people", "Tamil people", "Malayalam people", "Kannada people"]
    },
    Manchester: {
      "City Centre": ["Telugu people", "Tamil people", "Malayalam people"],
      Salford: ["Telugu people", "Kannada people", "Tamil people"]
    },
    Leeds: {
      Headingley: ["Telugu people", "Tamil people", "Kannada people"],
      "City Centre": ["Telugu people", "Malayalam people", "Tamil people"]
    }
  },
  India: {
    Hyderabad: {
      Gachibowli: ["Telugu people", "Tamil people", "Malayalam people"],
      Kukatpally: ["Telugu people", "Kannada people", "Tamil people"]
    },
    Bengaluru: {
      Whitefield: ["Kannada people", "Telugu people", "Tamil people"],
      Indiranagar: ["Kannada people", "Malayalam people", "Telugu people"]
    }
  }
};

const tabs = ["Feed", "Services", "Travel", "Sale", "Urgent"];
const expiringTabs = new Set(["Services", "Sale", "Urgent"]);

let context = getContextFromUrl();
let activeTab = "Feed";
let posts = [];
let conversations = [];
let notifications = [];
let messageTargetId = null;
let uploadImage = "";
let homePicker = null;
let authMode = "signup";
let profile = loadJson(profileKey, null);
const openComments = new Set();

const homeForm = document.querySelector("#explorerForm");
const postList = document.querySelector("#postList");
const homePage = document.querySelector("#homePage");
const communityPage = document.querySelector("#communityPage");
const authModal = document.querySelector("#authModal");
const authForm = document.querySelector("#authForm");
const inlineAuthForm = document.querySelector("#inlineAuthForm");

if (homeForm) initHome();
if (shouldShowCommunity()) {
  initCommunity();
} else {
  showView("home");
}
setupAuth();

function initHome() {
  updateMyCommunityLinks();
  homePicker = createPicker({
    country: document.querySelector("#countrySelect"),
    city: document.querySelector("#citySelect"),
    area: document.querySelector("#areaSelect"),
    community: document.querySelector("#communitySelect")
  }, profile?.community || context);

  homeForm.addEventListener("submit", event => {
    event.preventDefault();
    goToCommunity(homePicker.getValue(), "explore");
  });
}

function initCommunity() {
  updateMyCommunityLinks();
  showView("community");
  posts = loadCommunityPosts();
  conversations = loadJson(storageKey("messages"), []);
  notifications = loadJson(storageKey("notifications"), []);

  document.title = `${context.community} - ${brandName}`;
  document.querySelector("#communityTitle").textContent = context.community;
  document.querySelector("#communityLocation").textContent = `${context.country} / ${context.city} / ${context.area}`;

  renderTabs();
  renderPosts();
  setupCommunityEvents();
}

function setupAuth() {
  document.addEventListener("click", event => {
    const authButton = event.target.closest("[data-auth-mode]");
    if (!authButton) return;
    event.preventDefault();
    openAuth(authButton.dataset.authMode || "signup", { inline: true });
  });

  authForm?.addEventListener("submit", event => {
    event.preventDefault();
    completeAuth(new FormData(authForm));
    closeModal(authModal);
  });

  inlineAuthForm?.addEventListener("submit", event => {
    event.preventDefault();
    const selectedCommunity = completeAuth(new FormData(inlineAuthForm));
    const status = document.querySelector("#authStatus");
    if (status) status.textContent = `${authMode === "login" ? "Logged in" : "Account created"}. Opening My Community...`;
    window.setTimeout(() => goToCommunity(selectedCommunity, "my"), 350);
  });
}

function openAuth(mode, options = {}) {
  authMode = mode;
  const isLogin = mode === "login";
  updateAuthCopy(isLogin);

  if (options.inline && inlineAuthForm && !homePage?.classList.contains("hidden")) {
    inlineAuthForm.classList.remove("hidden");
    inlineAuthForm.reset();
    document.querySelector("#authStatus").textContent = "";
    inlineAuthForm.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusTarget = isLogin ? inlineAuthForm.elements.email : document.querySelector("#inlineAuthName");
    window.setTimeout(() => focusTarget?.focus(), 50);
    return;
  }

  authForm?.reset();
  openModal(authModal);
}

function updateAuthCopy(isLogin) {
  const modeLabel = isLogin ? "Log in" : "Sign up";
  const title = isLogin ? "Log in to My Local Teams" : "Join My Local Teams";
  const modalSubmit = isLogin ? "Log in" : "Create account";
  const inlineSubmit = isLogin ? "Log in and open community" : "Create account and open community";

  document.querySelector("#authModeLabel").textContent = modeLabel;
  document.querySelector("#authTitle").textContent = title;
  document.querySelector("#authSubmit").textContent = modalSubmit;
  const modalNameInput = document.querySelector("#authName");
  modalNameInput.classList.toggle("hidden", isLogin);
  modalNameInput.required = !isLogin;

  document.querySelector("#inlineAuthModeLabel").textContent = modeLabel;
  document.querySelector("#inlineAuthSubmit").textContent = inlineSubmit;
  const inlineNameInput = document.querySelector("#inlineAuthName");
  inlineNameInput.classList.toggle("hidden", isLogin);
  inlineNameInput.required = !isLogin;
}

function completeAuth(data) {
  const selectedCommunity = getActiveContext();
  const fallbackName = data.get("email") ? String(data.get("email")).split("@")[0] : "Member";
  profile = {
    name: authMode === "login" ? profile?.name || fallbackName : data.get("name"),
    email: data.get("email"),
    community: selectedCommunity
  };
  saveJson(profileKey, profile);
  updateMyCommunityLinks();
  return selectedCommunity;
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.add("is-open");
  document.body.classList.add("modal-fallback-open");
  try {
    if (typeof modal.showModal === "function" && !modal.open) {
      modal.showModal();
    } else {
      modal.setAttribute("open", "");
    }
  } catch {
    modal.setAttribute("open", "");
  }
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove("is-open");
  document.body.classList.remove("modal-fallback-open");
  if (typeof modal.close === "function" && modal.open) {
    modal.close();
  } else {
    modal.removeAttribute("open");
  }
}

function setupCommunityEvents() {
  document.querySelector("#tabStrip").addEventListener("click", event => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    activeTab = button.dataset.tab;
    renderTabs();
    renderPosts();
  });

  document.querySelector("#tabPostButton").addEventListener("click", openComposer);

  postList.addEventListener("click", event => {
    const askButton = event.target.closest("[data-ask]");
    const commentButton = event.target.closest("[data-toggle-comments]");

    if (askButton) {
      const post = posts.find(item => item.id === askButton.dataset.ask);
      if (!post) return;
      messageTargetId = post.id;
      document.querySelector("#messageTitle").textContent = `Message ${post.creator}`;
      document.querySelector("#messageForm").reset();
      openModal(document.querySelector("#messageModal"));
    }

    if (commentButton) {
      const postId = commentButton.dataset.toggleComments;
      if (openComments.has(postId)) {
        openComments.delete(postId);
      } else {
        openComments.add(postId);
      }
      renderPosts();
    }
  });

  postList.addEventListener("submit", event => {
    const form = event.target.closest("[data-comment-form]");
    if (!form) return;
    event.preventDefault();

    const post = posts.find(item => item.id === form.dataset.commentForm);
    if (!post) return;
    const data = new FormData(form);
    post.comments.push({
      name: data.get("name") || "Guest",
      text: data.get("comment"),
      time: "Just now"
    });
    openComments.add(post.id);
    savePosts();
    addNotification(`New public comment on "${post.title}".`, "comment");
    form.reset();
    renderPosts();
  });

  document.querySelector("#postForm").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const post = buildPost(data);
    posts.unshift(post);
    savePosts();
    addNotification(`New ${activeTab.toLowerCase()} post: ${post.title}`, activeTab.toLowerCase());
    uploadImage = "";
    const preview = document.querySelector("#imagePreview");
    preview.classList.add("hidden");
    preview.removeAttribute("src");
    event.currentTarget.reset();
    closeModal(document.querySelector("#composerModal"));
    renderTabs();
    renderPosts();
  });

  document.querySelector("#imageInput").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      uploadImage = reader.result;
      const preview = document.querySelector("#imagePreview");
      preview.src = uploadImage;
      preview.classList.remove("hidden");
    });
    reader.readAsDataURL(file);
  });

  document.querySelector("#messageForm").addEventListener("submit", event => {
    event.preventDefault();
    const post = posts.find(item => item.id === messageTargetId);
    if (!post) return;
    const data = new FormData(event.currentTarget);
    conversations.unshift({
      id: `message-${Date.now()}`,
      postId: post.id,
      with: post.creator,
      title: post.title,
      message: data.get("message"),
      time: "Just now",
      unread: true
    });
    saveJson(storageKey("messages"), conversations);
    addNotification(`Private Ask sent to ${post.creator}.`, "message");
    event.currentTarget.reset();
    closeModal(document.querySelector("#messageModal"));
  });
}

function renderTabs() {
  document.querySelector("#tabStrip").innerHTML = tabs.map(tab => `
    <button class="tab-button ${tab === activeTab ? "active" : ""}" type="button" data-tab="${tab}">
      ${tab}
    </button>
  `).join("");
  document.querySelector("#activeTabLabel").textContent = activeTab;
  document.querySelector("#feedTitle").textContent = `${activeTab} posts`;
}

function renderPosts() {
  const visiblePosts = posts.filter(post => {
    if (post.tab !== activeTab) return false;
    if (expiringTabs.has(post.tab) && isExpired(post)) return false;
    if (post.status === "sold") return activeTab === "Sale";
    return post.status === "active";
  });

  postList.innerHTML = visiblePosts.length
    ? visiblePosts.map(renderPostCard).join("")
    : `<div class="empty-state">No ${escapeHtml(activeTab.toLowerCase())} posts yet.</div>`;
}

function renderPostCard(post) {
  const isOpen = openComments.has(post.id);
  const commentCount = post.comments.length;
  const firstComment = post.comments[0];
  return `
    <article class="post-card">
      <div class="post-main">
        <span class="post-type">${escapeHtml(post.tab)}</span>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.description)}</p>
      </div>

      ${post.image ? `<img class="post-image" src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}">` : ""}

      <div class="post-meta-grid">
        <span>${escapeHtml(post.city)} / ${escapeHtml(post.area)}</span>
        <span>${escapeHtml(post.community)}</span>
        <span>By ${escapeHtml(post.creator)}</span>
        <span>${escapeHtml(post.time)}</span>
      </div>

      <div class="post-actions">
        <button class="mini-button primary-mini" type="button" data-ask="${post.id}">Ask</button>
        <button class="mini-button" type="button" data-toggle-comments="${post.id}">
          Comment ${commentCount}
        </button>
      </div>

      ${firstComment && !isOpen ? `
        <div class="comment-preview">${escapeHtml(firstComment.name)}: ${escapeHtml(firstComment.text)}</div>
      ` : ""}

      <div class="comments ${isOpen ? "" : "is-collapsed"}">
        ${post.comments.length ? post.comments.map(comment => `
          <div class="comment"><strong>${escapeHtml(comment.name)}</strong>: ${escapeHtml(comment.text)}</div>
        `).join("") : `<div class="comment muted-comment">No public comments yet.</div>`}
        <form class="comment-form" data-comment-form="${post.id}">
          <input name="name" type="text" placeholder="Name" required>
          <textarea name="comment" placeholder="Write public comment" required></textarea>
          <button class="mini-button" type="submit">Send</button>
        </form>
      </div>
    </article>
  `;
}

function openComposer() {
  document.querySelector("#composerMode").textContent = activeTab;
  document.querySelector("#composerTitle").textContent = `Create ${activeTab.toLowerCase()} post`;
  document.querySelector("#dynamicFields").innerHTML = fieldsForTab(activeTab);
  openModal(document.querySelector("#composerModal"));
}

function fieldsForTab(tab) {
  if (tab === "Services") {
    return `
      <input name="serviceCategory" type="text" placeholder="Service type, e.g. plumber">
      <input name="serviceAreas" type="text" placeholder="Areas covered">
      <input name="expiryDays" type="number" min="1" max="90" value="30" placeholder="Active days">
    `;
  }

  if (tab === "Travel") {
    return `
      <input name="place" type="text" placeholder="Place visited">
      <input name="tip" type="text" placeholder="Simple tip">
    `;
  }

  if (tab === "Sale") {
    return `
      <input name="price" type="text" placeholder="Price">
      <input name="condition" type="text" placeholder="Condition">
      <input name="expiryDays" type="number" min="1" max="60" value="21" placeholder="Active days">
    `;
  }

  if (tab === "Urgent") {
    return `
      <input name="urgency" type="text" placeholder="Urgency level">
      <input name="expiryHours" type="number" min="1" max="72" value="24" placeholder="Active hours">
    `;
  }

  return "";
}

function buildPost(data) {
  const post = {
    id: `local-${Date.now()}`,
    tab: activeTab,
    title: data.get("title"),
    description: data.get("description"),
    country: context.country,
    city: context.city,
    area: context.area,
    community: context.community,
    creator: "You",
    time: "Just now",
    status: "active",
    comments: [],
    expiresAt: null,
    image: uploadImage,
    extra: {}
  };

  if (activeTab === "Services") {
    post.expiresAt = daysFromNow(Number(data.get("expiryDays") || 30));
    post.extra = {
      serviceCategory: data.get("serviceCategory"),
      serviceAreas: data.get("serviceAreas"),
      rating: 5,
      reviews: []
    };
  }

  if (activeTab === "Travel") {
    post.extra = {
      place: data.get("place"),
      tip: data.get("tip")
    };
  }

  if (activeTab === "Sale") {
    post.expiresAt = daysFromNow(Number(data.get("expiryDays") || 21));
    post.extra = {
      price: data.get("price"),
      condition: data.get("condition"),
      isSold: false
    };
  }

  if (activeTab === "Urgent") {
    post.expiresAt = hoursFromNow(Number(data.get("expiryHours") || 24));
    post.extra = {
      urgency: data.get("urgency")
    };
  }

  return post;
}

function loadCommunityPosts() {
  const key = storageKey("posts");
  const versionKey = storageKey("version");
  if (localStorage.getItem(versionKey) !== appVersion) {
    localStorage.setItem(versionKey, appVersion);
    localStorage.removeItem(key);
    localStorage.removeItem(storageKey("messages"));
    localStorage.removeItem(storageKey("notifications"));
  }
  return loadJson(key, starterPosts(context));
}

function starterPosts(base) {
  return [
    makePost(base, "Feed", "Anyone going to Meadowhall this weekend?", "Planning to go Saturday afternoon. Happy to coordinate from nearby areas.", "Anusha", "22 min ago", [
      { name: "Kiran", text: "We may go after lunch.", time: "18 min ago" }
    ]),
    makePost(base, "Feed", "New Telugu family in Sheffield looking to connect.", "We moved recently and would like to meet nearby families.", "Sravya", "44 min ago", [
      { name: "Ravi", text: "Welcome to Sheffield.", time: "8 min ago" }
    ]),
    makePost(base, "Services", "Reliable plumber available in Sheffield.", "Available for leaks, tap replacements, and small bathroom repairs.", "Suresh", "1 hr ago", [
      { name: "Priya", text: "Helped us last month.", time: "1 hr ago" }
    ], daysFromNow(30), { rating: 4.8, reviews: 18, serviceAreas: "Sheffield" }),
    makePost(base, "Services", "Need electrician for light fitting.", "Looking for someone reliable today or tomorrow.", "Meera", "48 min ago", [
      { name: "Arun", text: "I know someone who covers S1 and S2.", time: "36 min ago" }
    ], daysFromNow(7), { rating: 4.5, reviews: 6, serviceAreas: base.area }),
    makePost(base, "Travel", "Peak District trip - parking easy before 10 AM.", "We visited early and it was calm. Parking became busy later.", "Vikram", "2 hr ago", [
      { name: "Lakshmi", text: "Useful for next weekend.", time: "2 hr ago" }
    ]),
    makePost(base, "Travel", "London trip - very crowded near Tower Bridge.", "Avoid midday if travelling with family. Start early if possible.", "Harini", "3 hr ago", [
      { name: "Naveen", text: "Was this during school holidays?", time: "1 hr ago" }
    ]),
    makePost(base, "Sale", "Dining table for sale £40.", "Four-seater table in good condition. Collection from City Centre.", "Deepa", "25 min ago", [
      { name: "Sanjay", text: "Can it fit in a small car?", time: "25 min ago" }
    ], daysFromNow(20), { price: "£40", condition: "Good" }),
    makePost(base, "Sale", "Baby stroller available in good condition.", "Lightweight stroller, clean and ready for collection.", "Akhil", "55 min ago", [
      { name: "Nisha", text: "Please share pickup area.", time: "10 min ago" }
    ], daysFromNow(14), { price: "Open to offers", condition: "Good" }),
    makePost(base, "Urgent", "Parents travelling from Hyderabad to Manchester, need companion.", "Looking for someone on the same route this week.", "Ramesh", "5 min ago", [
      { name: "Sirisha", text: "Please add flight date.", time: "5 min ago" }
    ], hoursFromNow(30), { urgency: "High" }),
    makePost(base, "Urgent", "Anyone going Sheffield to London tomorrow morning?", "Need help sending a small document packet.", "Bhavana", "9 min ago", [
      { name: "Manoj", text: "I am going by train at 8:30 AM.", time: "2 min ago" }
    ], hoursFromNow(22), { urgency: "High" })
  ];
}

function makePost(base, tab, title, description, creator, time, comments = [], expiresAt = null, extra = {}) {
  return {
    id: slug(`${tab}-${title}`),
    tab,
    title,
    description,
    country: base.country,
    city: base.city,
    area: base.area,
    community: base.community,
    creator,
    time,
    status: "active",
    comments,
    expiresAt,
    image: "",
    extra
  };
}

function createPicker(selects, initialContext) {
  const state = { ...defaultContext, ...initialContext };
  const countrySelect = selects.country;
  const citySelect = selects.city;
  const areaSelect = selects.area;
  const communitySelect = selects.community;
  if (!countrySelect || !citySelect || !areaSelect || !communitySelect) {
    return { getValue: () => state };
  }

  countrySelect.innerHTML = Object.keys(communityTree).map(option).join("");
  countrySelect.value = communityTree[state.country] ? state.country : defaultContext.country;

  function syncCities() {
    const cities = Object.keys(communityTree[countrySelect.value]);
    citySelect.innerHTML = cities.map(option).join("");
    if (!cities.includes(state.city)) state.city = cities[0];
    citySelect.value = state.city;
    syncAreas();
  }

  function syncAreas() {
    const areas = Object.keys(communityTree[countrySelect.value][citySelect.value]);
    areaSelect.innerHTML = areas.map(option).join("");
    if (!areas.includes(state.area)) state.area = areas[0];
    areaSelect.value = state.area;
    syncCommunities();
  }

  function syncCommunities() {
    const communities = communityTree[countrySelect.value][citySelect.value][areaSelect.value];
    communitySelect.innerHTML = communities.map(option).join("");
    if (!communities.includes(state.community)) state.community = communities[0];
    communitySelect.value = state.community;
  }

  function getValue() {
    return {
      country: countrySelect.value,
      city: citySelect.value,
      area: areaSelect.value,
      community: communitySelect.value
    };
  }

  countrySelect.addEventListener("change", () => {
    state.country = countrySelect.value;
    state.city = "";
    state.area = "";
    state.community = "";
    syncCities();
  });

  citySelect.addEventListener("change", () => {
    state.city = citySelect.value;
    state.area = "";
    state.community = "";
    syncAreas();
  });

  areaSelect.addEventListener("change", () => {
    state.area = areaSelect.value;
    state.community = "";
    syncCommunities();
  });

  communitySelect.addEventListener("change", () => {
    state.community = communitySelect.value;
  });

  syncCities();
  return { getValue };
}

function option(value) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`;
}

function getContextFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    country: params.get("country") || defaultContext.country,
    city: params.get("city") || defaultContext.city,
    area: params.get("area") || defaultContext.area,
    community: params.get("community") || defaultContext.community
  };
}

function goToCommunity(nextContext, mode) {
  const params = new URLSearchParams({ ...nextContext, mode });
  window.location.href = `index.html?${params.toString()}`;
}

function updateMyCommunityLinks() {
  const params = new URLSearchParams({ ...(profile?.community || defaultContext), mode: "my" });
  document.querySelectorAll("[data-my-community-link]").forEach(link => {
    link.setAttribute("href", `index.html?${params.toString()}`);
  });
}

function getActiveContext() {
  return homePicker?.getValue() || profile?.community || context || defaultContext;
}

function shouldShowCommunity() {
  const params = new URLSearchParams(window.location.search);
  return params.has("mode") || params.has("country") || params.has("city") || params.has("area") || params.has("community");
}

function showView(view) {
  const isCommunity = view === "community";
  homePage?.classList.toggle("hidden", isCommunity);
  communityPage?.classList.toggle("hidden", !isCommunity);
  document.querySelector("#homeNavLink")?.classList.toggle("active", !isCommunity);
  document.querySelector("#communityNavLink")?.classList.toggle("active", isCommunity);
  if (!isCommunity) document.title = brandName;
}

function addNotification(message, type) {
  notifications.unshift({
    message,
    type,
    time: "Just now"
  });
  notifications = notifications.slice(0, 20);
  saveJson(storageKey("notifications"), notifications);
}

function savePosts() {
  saveJson(storageKey("posts"), posts);
}

function storageKey(scope) {
  return `my_local_teams_${scope}_${slug([context.country, context.city, context.area, context.community].join("_"))}`;
}

function isExpired(post) {
  return post.expiresAt ? new Date(post.expiresAt).getTime() < Date.now() : false;
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 3600000).toISOString();
}

function daysFromNow(days) {
  return hoursFromNow(days * 24);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function loadJson(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("click", event => {
  const closeButton = event.target.closest("[data-close]");
  if (closeButton) closeModal(closeButton.closest("dialog"));
});
