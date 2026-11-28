(() => {
  // ../../../../../springs.mjs
  var active = /* @__PURE__ */ new Set();
  var frame = 0;
  var last = 0;
  var reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function loop(now) {
    const dt = Math.min((now - last) / 1e3, 1 / 30);
    last = now;
    for (const s of active) {
      for (let i = 0; i < 4; i++) {
        const a = (-s.k * (s.x - s.t) - s.c * s.v) / s.mass;
        s.v += a * dt / 4;
        s.x += s.v * dt / 4;
      }
      s.draw(s.x);
      if (Math.abs(s.x - s.t) < 1e-3 && Math.abs(s.v) < 1e-3) {
        s.x = s.t;
        s.draw(s.x);
        active.delete(s);
      }
    }
    frame = active.size ? requestAnimationFrame(loop) : 0;
  }
  function spring(x, preset, draw) {
    const [k, c, mass = 1] = preset, s = { x, t: x, v: 0, k, c, mass, draw, set(t) {
      s.t = t;
      if (reduced()) {
        s.x = t;
        s.v = 0;
        draw(t);
        return;
      }
      active.add(s);
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    }, jump(x2) {
      s.x = x2;
      s.v = 0;
      draw(x2);
    }, destroy() {
      active.delete(s);
    } };
    draw(x);
    return s;
  }

  // ../r08/cards.js
  var cards = [
    {
      "id": "photo",
      "name": "\u6444\u5F71\u5E08\u5C0F\u9E7F",
      "number": "01",
      "url": "/api/assets/0a4785fc-347b-4e66-824d-172f8ec4e4a9.png"
    },
    {
      "id": "paint",
      "name": "\u753B\u5BB6\u5C0F\u9E7F",
      "number": "02",
      "url": "/api/assets/2f5733ac-fb7b-4e2b-867d-e7099607a5c4.png"
    },
    {
      "id": "code",
      "name": "\u4EE3\u7801\u5C0F\u9E7F",
      "number": "03",
      "url": "/api/assets/e0b9c81f-42a5-4220-939c-97064c5b32d8.png"
    },
    {
      "id": "director",
      "name": "\u5BFC\u6F14\u5C0F\u9E7F",
      "number": "04",
      "url": "/api/assets/6bf30feb-9e21-4714-8828-ef165f0c4cc6.png"
    },
    {
      "id": "ballet",
      "name": "\u82AD\u857E\u5C0F\u9E7F",
      "number": "05",
      "url": "/api/assets/ef57cf88-9dbd-429d-a881-451fbc3be0ee.png"
    },
    {
      "id": "sleep",
      "name": "\u84DD\u6761\u7EB9\u7761\u8863\u5C0F\u9E7F",
      "number": "06",
      "url": "/api/assets/a88a8f5f-4ff4-4b75-a834-45c5961c7239.png"
    },
    {
      "id": "angel",
      "name": "\u5929\u4F7F\u5C0F\u9E7F",
      "number": "07",
      "url": "/api/assets/a1dc413e-99d3-47f4-9700-2e192abbc650.png"
    }
  ];

  // ../r04/names.js
  var cardNames = {
    photo: "\u5494\u5693",
    paint: "\u6CE2\u70B9\u70B9",
    code: "\u7801\u4E0A\u597D",
    director: "\u5361\u4E00\u6761",
    ballet: "\u8E2E\u8E2E",
    sleep: "\u518D\u772F\u4E94\u5206",
    angel: "\u5929\u964D\u5C0F\u95EA"
  };

  // effects.mjs
  var effects = {
    photo: ["lens", "\u955C\u9762\u4E0E\u968F\u52A8\u9634\u5F71", "\u955C\u5934\u5149\u6591\u626B\u8FC7\u6574\u5F20\u5361\uFF0C\u684C\u9762\u4E0A\u7684\u6295\u5F71\u671D\u53CD\u65B9\u5411\u79FB\u3002"],
    paint: ["reverse", "\u53CD\u5411\u73AB\u91D1\u7B94", "\u8FB9\u6846\u548C\u5361\u540D\u533A\u4E00\u8D77\u95EA\u73AB\u91D1\uFF0C\u63D2\u753B\u4FDD\u7559\u539F\u6709\u8272\u8C03\u3002"],
    code: ["scan", "\u8367\u5149\u626B\u63CF\u7EBF", "\u4E0A\u4E0B\u79FB\u52A8\u5149\u6807\uFF0C\u9752\u7EFF\u5149\u5E26\u4ECE\u5361\u9876\u626B\u5230\u5361\u5E95\u3002"],
    director: ["film", "\u62C9\u4E1D\u94DC\u91D1", "\u659C\u5411\u7684\u91D1\u5C5E\u7EC6\u7EB9\u7559\u5728\u539F\u4F4D\uFF0C\u660E\u6697\u4EA4\u754C\u968F\u89D2\u5EA6\u79FB\u52A8\u3002"],
    ballet: ["depth", "\u7ACB\u4F53\u5206\u5C42", "\u5C0F\u9E7F\u3001\u6807\u9898\u548C\u5E95\u5361\u5728\u4E0D\u540C\u6DF1\u5EA6\uFF0C\u503E\u659C\u65F6\u80FD\u770B\u5230\u5404\u5C42\u9519\u5F00\u3002"],
    sleep: ["cosmos", "\u94F6\u6CB3\u661F\u70B9", "\u7EC6\u788E\u7684\u661F\u5149\u6CBF\u7740\u4E00\u6761\u6DE1\u661F\u4E91\u6563\u5F00\uFF0C\u503E\u659C\u65F6\u4E24\u5C42\u5FAE\u5FAE\u9519\u52A8\u3002"],
    angel: ["prism", "\u653E\u5C04\u5F69\u8679\u7B94", "\u5F69\u8679\u6E10\u53D8\u548C\u653E\u5C04\u7EB9\u4E00\u8D77\u79FB\u52A8\uFF0C\u4EAE\u5149\u4ECE\u5361\u5FC3\u6269\u5230\u5361\u9762\u3002"]
  };
  var card = document.querySelector(".card");
  var mascot = card.querySelector(".mascot");
  var characterPicker = document.querySelector("#character");
  var effectPicker = document.querySelector(".effects");
  var effectNote = document.querySelector("#effect-note");
  var clamp = (value) => Math.min(0.5, Math.max(-0.5, value));
  var shiftX = spring(0, [295, 22], (value) => {
    card.style.setProperty("--light-x", value * 100 + "%");
    card.style.setProperty("--turn-y", value * 23 + "deg");
    card.style.setProperty("--shift-x", value * 52 + "px");
  });
  var shiftY = spring(0, [295, 22], (value) => {
    card.style.setProperty("--light-y", value * 100 + "%");
    card.style.setProperty("--turn-x", value * 23 + "deg");
    card.style.setProperty("--shift-y", value * 52 + "px");
  });
  var scale = spring(0, [295, 22], (amount) => {
    card.style.setProperty("--lift", 1 + amount * 0.065);
    card.style.setProperty("--mascot-depth", 9 + amount * 11 + "cqw");
    card.style.setProperty("--gloss", 0.18 + amount * 0.48);
  });
  for (const role of cards) characterPicker.add(new Option(role.name, role.id));
  for (const [id, name] of Object.values(effects)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.effect = id;
    button.textContent = name;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => applyEffect(id));
    effectPicker.append(button);
  }
  var byEffect = new Map(Object.values(effects).map((effect) => [effect[0], effect]));
  var direction = 1;
  var aim = { x: 0, y: 0 };
  function aimCard(x, y) {
    aim = { x: clamp(x), y: clamp(y) };
    shiftX.set(aim.x);
    shiftY.set(aim.y);
    scale.set(Math.min(1, Math.hypot(aim.x, aim.y) * 2.5));
  }
  function applyEffect(id) {
    const [effect, , description] = byEffect.get(id);
    card.dataset.effect = effect;
    for (const button of effectPicker.children) {
      button.setAttribute("aria-pressed", String(button.dataset.effect === effect));
    }
    effectNote.textContent = description;
  }
  function selectCard() {
    const role = cards[characterPicker.selectedIndex];
    card.dataset.finish = role.id;
    mascot.src = role.url;
    card.querySelector(".card-copy strong").textContent = cardNames[role.id];
    card.querySelector(".card-copy small").textContent = role.name;
    card.querySelector(".card-number").textContent = "No." + role.number.padStart(4, "0");
    card.setAttribute("aria-label", role.name + "\uFF0C\u8BD5\u52A8\u6548");
  }
  characterPicker.addEventListener("change", selectCard);
  document.querySelector(".recommendation").addEventListener("click", () => applyEffect(effects[characterPicker.value][0]));
  card.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const bounds = card.getBoundingClientRect();
    aimCard((event.clientX - bounds.left) / bounds.width - 0.5, 0.5 - (event.clientY - bounds.top) / bounds.height);
  });
  card.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "touch") aimCard(0, 0);
  });
  card.addEventListener("pointercancel", () => aimCard(0, 0));
  card.addEventListener("blur", () => aimCard(0, 0));
  card.addEventListener("click", (event) => {
    if (event.pointerType === "mouse") return;
    aimCard(0.43 * direction, 0.2);
    direction *= -1;
  });
  var keys = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, 0.15], ArrowDown: [0, -0.15] };
  card.addEventListener("keydown", (event) => {
    const step = keys[event.key];
    if (!step) return;
    event.preventDefault();
    aimCard(aim.x + step[0], aim.y + step[1]);
  });
  characterPicker.value = "code";
  selectCard();
  applyEffect(effects[characterPicker.value][0]);
})();
